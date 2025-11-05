"use client"
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Save, Loader2, RotateCcw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { normalizeResponseError } from '@/lib/error'

// Lazy load Monaco React wrapper on client only
const MonacoEditor = dynamic(async () => (await import('@monaco-editor/react')).default, {
  ssr: false,
})

export type MonacoScriptEditorHandle = {
  insertAtCursor: (text: string, opts?: { ensureNewLine?: boolean }) => void
  getCursor: () => number | null
  setCursor: (pos: number) => void
  reloadTypings: () => Promise<void>
  getTypingsStatus: () => { global: string[]; relatives: string[] }
}

type CachedFileEntry = { content: string; original: string }

interface Props {
  filePath: string
  cachedValue?: CachedFileEntry
  onContentChange?: (value: string, info?: { dirty: boolean; filePath: string }) => void
  onContentLoaded?: (payload: CachedFileEntry, context: { filePath: string }) => void
  onContentSaved?: (payload: CachedFileEntry, context: { filePath: string }) => void
  extraActions?: ReactNode
  wrapAtColumn?: number
}

export const MonacoScriptEditor = forwardRef<MonacoScriptEditorHandle, Props>(function MonacoScriptEditor(
  { filePath, cachedValue, onContentChange, onContentLoaded, onContentSaved, extraActions, wrapAtColumn },
  ref
) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const originalRef = useRef('')
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<any>(null)
  const extraLibDisposablesRef = useRef<any[]>([])
  const globalTypingUrisRef = useRef<string[]>([])
  const extraFileLibsRef = useRef<Record<string, any>>({})
  const importScanTimerRef = useRef<any>(null)
  const { theme } = useTheme()

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light'
  const options = useMemo(() => {
    const col = typeof wrapAtColumn === 'number' ? Math.max(20, Math.min(240, wrapAtColumn | 0)) : 80
    return {
      automaticLayout: true,
      readOnly: loading || saving,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: typeof wrapAtColumn === 'number' ? 'bounded' : 'off',
      wordWrapColumn: col,
      rulers: typeof wrapAtColumn === 'number' ? [col] : [],
      fontLigatures: true,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'none',
    } as any
  }, [loading, saving, wrapAtColumn])

  const fetchServerContent = useCallback(
    async (opts?: { showSkeleton?: boolean }) => {
      if (!filePath) return
      const showSkeleton = opts?.showSkeleton ?? true
      if (showSkeleton) setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/files/script?path=${encodeURIComponent(filePath)}`, {
          method: 'GET',
          credentials: 'include',
        })
        if (!res.ok) {
          const err = await normalizeResponseError(res)
          throw new Error(err.message || 'Loading failed')
        }
        const data = await res.json()
        const next = data['content'] ?? ''
        setContent(next)
        originalRef.current = next
        setChanged(false)
        onContentLoaded?.({ content: next, original: next }, { filePath })
        onContentChange?.(next, { dirty: false, filePath })
        // apply saved cursor
        try {
          const raw = localStorage.getItem(`gtt:cursor:${filePath}`)
          const pos = raw ? parseInt(raw, 10) : 0
          if (Number.isFinite(pos)) {
            const ed = editorRef.current
            if (ed) {
              const model = ed.getModel()
              if (model) {
                const p = model.getPositionAt(Math.max(0, Math.min(pos, model.getValueLength())))
                ed.setPosition(p)
                ed.revealPositionInCenter(p)
              }
            }
          }
        } catch {}
      } catch (e: any) {
        setError(e?.message || 'Loading failed')
        return false
      } finally {
        if (showSkeleton) setLoading(false)
      }
      return true
    },
    [filePath, onContentChange, onContentLoaded]
  )

  // Resolve and attach relative import files as extra libs for TS LS (with limited recursion)
  const attachRelativeImports = useCallback(async (code: string, depth: number = 2) => {
    const monaco = monacoRef.current
    if (!monaco || !filePath) return
    const rootUri = `file:///` + filePath.replace(/^\/+/, '')
    const dirname = (u: string) => u.replace(/[^/]+$/, '')
    // Normalize a file:// URI to server path without leading slash, e.g. file:///a/b -> a/b
    const toServerPath = (uri: string) => uri.replace(/^file:\/+/, '').replace(/^\/+/, '')
    // Join and normalize without leading slash, e.g. '/a/b' + '../c' -> 'a/c'
    const join = (dir: string, seg: string) => {
      const parts: string[] = (dir + seg).split('/')
      const out: string[] = []
      for (const t of parts) {
        if (!t || t === '.') continue
        if (t === '..') out.pop()
        else out.push(t)
      }
      return out.join('/')
    }
    // Restrict traversal to a safe root derived from the current file
    const allowedRoot = (() => {
      const p = (filePath || '').replace(/^\/+/, '')
      const parts = p.split('/')
      if (parts[0] === 'workspace' && parts[1] === 'users' && parts[2]) {
        return `workspace/users/${parts[2]}`
      }
      if (parts[0] === 'workspace' && parts[1] === 'shared-libs') {
        return 'workspace/shared-libs'
      }
      return parts[0] || ''
    })()
    const parseSpecs = (src: string) =>
      Array.from(src.matchAll(/\bfrom\s*['"](\.[^'"]+)['"];?|\bimport\s*['"](\.[^'"]+)['"]/g))
        .map((m) => m[1] || m[2])
        .filter(Boolean) as string[]

    const collected = new Map<string, string>() // uri -> content
    const visited = new Set<string>()

    const resolveOne = async (baseDir: string, spec: string): Promise<{ uri: string; content: string } | null> => {
      const basePath = join(baseDir.replace(/^file:\/\//, ''), spec)
      const candidates = [
        basePath + '.ts',
        basePath + '.d.ts',
        basePath + '/index.ts',
        basePath + '/index.d.ts',
        // TSX as a last resort if project actually contains tsx modules
        basePath + '.tsx',
      ]
      for (const c of candidates) {
        const uri = 'file://' + c
        if (visited.has(uri)) return null
        try {
          const sp = toServerPath(uri)
          if (!sp) continue
          // Skip files outside the allowed root to avoid probing unrelated/nonexistent paths
          if (allowedRoot && !sp.startsWith(allowedRoot)) continue
          const res = await fetch(`/api/files/script?path=${encodeURIComponent(sp)}`, {
            method: 'GET',
            credentials: 'include',
          })
          if (!res.ok) continue
          const data = await res.json()
          const content = (data?.content ?? '').toString()
          if (!content) continue
          return { uri: uri.replace(/^file:\/\//, 'file:///'), content }
        } catch {}
      }
      return null
    }

    const walk = async (baseDir: string, src: string, d: number) => {
      if (d < 0) return
      const specs = parseSpecs(src)
      for (const spec of specs) {
        const r = await resolveOne(baseDir, spec)
        if (!r) continue
        if (visited.has(r.uri)) continue
        visited.add(r.uri)
        collected.set(r.uri, r.content)
        await walk(dirname(r.uri), r.content, d - 1)
      }
    }

    await walk(dirname(rootUri), code, depth)

    // compute desired uris
    const want = new Set<string>(Array.from(collected.keys()))
    // add newly referenced
    for (const [uri, text] of collected) {
      if (extraFileLibsRef.current[uri]) continue
      try {
        const disp = monaco.languages.typescript.typescriptDefaults.addExtraLib(text, uri)
        extraFileLibsRef.current[uri] = disp
      } catch {}
    }
    // dispose stale
    for (const uri of Object.keys(extraFileLibsRef.current)) {
      if (!want.has(uri)) {
        try { extraFileLibsRef.current[uri]?.dispose?.() } catch {}
        delete extraFileLibsRef.current[uri]
      }
    }
  }, [filePath])

  // Load content or use cache
  useEffect(() => {
    if (!filePath) return
    if (cachedValue) {
      setLoading(false)
      setError(null)
      setContent(cachedValue.content)
      originalRef.current = cachedValue.original
      setChanged(cachedValue.content !== cachedValue.original)
      return
    }
    fetchServerContent({ showSkeleton: true })
  }, [filePath, cachedValue, fetchServerContent])

  // Save file
  const save = useCallback(async () => {
    if (!filePath || saving || !changed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        throw new Error(err.message || 'Save failed')
      }
      originalRef.current = content
      setChanged(false)
      onContentSaved?.({ content, original: content }, { filePath })
      onContentChange?.(content, { dirty: false, filePath })
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [filePath, content, changed, saving, onContentChange, onContentSaved])

  // Inject typings from backend
  const reloadTypings = useCallback(async () => {
    const monaco = monacoRef.current
    if (!monaco) return
    if ((reloadTypings as any)._busy) return
    ;(reloadTypings as any)._busy = true
    try {
      // ensure the TS worker eagerly syncs models so the main file isn't missing
      try { monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true) } catch {}
      // dispose previous
      for (const d of extraLibDisposablesRef.current) try { d.dispose() } catch {}
      extraLibDisposablesRef.current = []
      // reset global list each reload
      try { globalTypingUrisRef.current = [] } catch {}

      // Try to fetch real typings from backend; fall back gracefully on error
      const res = await fetch('/api/testcase/typings', { cache: 'no-store' })
      let files: { path: string; content: string }[] = []
      if (res.ok) {
        try {
          const json = await res.json()
          files = json?.files || []
        } catch {}
      }
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        allowJs: true,
        allowNonTsExtensions: true,
        allowSyntheticDefaultImports: true,
        jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
        experimentalDecorators: true,
        baseUrl: 'file:///',
        typeRoots: [],
      })
      // Provide robust fallback shims so `import 'core-lib'` resolves even if paths fail
      try {
        extraLibDisposablesRef.current.push(
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            "export * from 'file:///types/core-lib/dist/index.d.ts'",
            'file:///node_modules/core-lib/index.d.ts'
          )
        )
        extraLibDisposablesRef.current.push(
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            "export * from 'file:///types/gettr-lib/dist/index.d.ts'",
            'file:///node_modules/gettr-lib/index.d.ts'
          )
        )
        extraLibDisposablesRef.current.push(
          monaco.languages.typescript.typescriptDefaults.addExtraLib(
            "export * from 'file:///types/gettr-android-lib/dist/index.d.ts'",
            'file:///node_modules/gettr-android-lib/index.d.ts'
          )
        )
      } catch {}
      // Load all declaration files and compute module entrypoints per lib
      const toUri = (p: string) => 'file:///' + p.replace(/^\/+/, '')
      const pushGlobal = (u: string) => { try { (globalTypingUrisRef.current ||= []).push(u) } catch {} }
      const uris: string[] = []
      for (const f of files) {
        const uri = toUri(f.path)
        uris.push(uri)
        const disp = monaco.languages.typescript.typescriptDefaults.addExtraLib(f.content, uri)
        extraLibDisposablesRef.current.push(disp)
        pushGlobal(uri)
      }
      const uriSet = new Set(uris)

      const pickEntryOrBundle = (lib: string) => {
        const base = `file:///types/${lib}/dist/`
        const inLib = uris.filter((u) => u.startsWith(base) && u.endsWith('.d.ts'))
        const candidates = [
          `${base}index.d.ts`,
          `${base}src/index.d.ts`,
          `${base}index.d.mts`,
          `${base}src/index.d.mts`,
        ]
        for (const c of candidates) if (uriSet.has(c)) return c
        // try any */index.d.ts under dist
        const idx = inLib.find((u) => /\/index\.d\.ts$/.test(u))
        if (idx) return idx
        if (inLib.length > 0) {
          const bundleUri = `file:///ambient/${lib}-bundle.d.ts`
          const content = inLib.map((u) => `export * from '${u}';`).join('\n')
          const disp = monaco.languages.typescript.typescriptDefaults.addExtraLib(content, bundleUri)
          extraLibDisposablesRef.current.push(disp)
          pushGlobal(bundleUri)
          return bundleUri
        }
        return null
      }

      const coreEntry = pickEntryOrBundle('core-lib')
      const gettrEntry = pickEntryOrBundle('gettr-lib')
      const androidEntry = pickEntryOrBundle('gettr-android-lib')

      const makeAmbient = (mod: string, target: string | null) =>
        target ? `declare module '${mod}' { export * from '${target}'; }` : `declare module '${mod}' { }`

      const ambientCore = makeAmbient('core-lib', coreEntry)
      const ambientGettr = makeAmbient('gettr-lib', gettrEntry)
      const ambientAndroid = makeAmbient('gettr-android-lib', androidEntry)

      extraLibDisposablesRef.current.push(
        monaco.languages.typescript.typescriptDefaults.addExtraLib(ambientCore, 'file:///ambient/core-lib.d.ts')
      )
      pushGlobal('file:///ambient/core-lib.d.ts')
      extraLibDisposablesRef.current.push(
        monaco.languages.typescript.typescriptDefaults.addExtraLib(ambientGettr, 'file:///ambient/gettr-lib.d.ts')
      )
      pushGlobal('file:///ambient/gettr-lib.d.ts')
      extraLibDisposablesRef.current.push(
        monaco.languages.typescript.typescriptDefaults.addExtraLib(ambientAndroid, 'file:///ambient/gettr-android-lib.d.ts')
      )
      pushGlobal('file:///ambient/gettr-android-lib.d.ts')

      // Node resolution shims under virtual node_modules as additional safety net
      const addNodeShim = (lib: string, target: string | null) => {
        const uri = `file:///node_modules/${lib}/index.d.ts`
        const code = target ? `export * from '${target}';` : 'export {}'
        extraLibDisposablesRef.current.push(
          monaco.languages.typescript.typescriptDefaults.addExtraLib(code, uri)
        )
        pushGlobal(uri)
      }
      addNodeShim('core-lib', coreEntry)
      addNodeShim('gettr-lib', gettrEntry)
      addNodeShim('gettr-android-lib', androidEntry)
    } catch {}
    finally {
      ;(reloadTypings as any)._busy = false
    }
  }, [])

  const scheduleAttachImports = useCallback((next: string) => {
    try { if (importScanTimerRef.current) clearTimeout(importScanTimerRef.current) } catch {}
    importScanTimerRef.current = setTimeout(() => attachRelativeImports(next), 300)
  }, [attachRelativeImports])

  // Expose imperative API
  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor: (text: string, opts?: { ensureNewLine?: boolean }) => {
        const ed = editorRef.current
        if (!ed) return
        const ins = opts?.ensureNewLine ? `${text}\n` : text
        const model = ed.getModel()
        if (!model) return
        const pos = ed.getPosition() || model.getPositionAt(0)
        ed.executeEdits('insert', [{ range: new (monacoRef.current as any).Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text: ins }])
        const newPos = model.modifyPosition(pos, ins.length)
        ed.setPosition(newPos)
        try { ed.focus() } catch {}
        try { localStorage.setItem(`gtt:cursor:${filePath}`, String(model.getOffsetAt(newPos))) } catch {}
      },
      getCursor: () => {
        const ed = editorRef.current
        const monaco = monacoRef.current
        if (!ed || !monaco) return null
        const model = ed.getModel()
        if (!model) return null
        const pos = ed.getPosition()
        return pos ? model.getOffsetAt(pos) : null
      },
      setCursor: (absolute: number) => {
        const ed = editorRef.current
        const model = ed?.getModel()
        if (!ed || !model) return
        const clamped = Math.max(0, Math.min(absolute, model.getValueLength()))
        const pos = model.getPositionAt(clamped)
        ed.setPosition(pos)
        ed.revealPositionInCenter(pos)
      },
      reloadTypings,
      getTypingsStatus: () => {
        const relatives = Object.keys(extraFileLibsRef.current || {})
          .map((u) => u.replace(/^file:\/\//, ''))
        const global = Array.from(new Set((globalTypingUrisRef.current || []).map((u) => u.replace(/^file:\/\//, ''))))
        return { global, relatives }
      },
    }),
    [filePath, reloadTypings]
  )

  const handleMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco
    // Keybinding for save
    try {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save())
    } catch {}
    // Cursor persistence
    try {
      editor.onDidChangeCursorPosition(() => {
        const model = editor.getModel()
        if (!model) return
        const pos = editor.getPosition()
        if (!pos) return
        try { localStorage.setItem(`gtt:cursor:${filePath}`, String(model.getOffsetAt(pos))) } catch {}
      })
    } catch {}
    // Initial types
    reloadTypings()
    // Initial import resolution
    try { const model = editor.getModel(); if (model) attachRelativeImports(model.getValue(), 2) } catch {}
  }, [filePath, save, reloadTypings])

  if (!filePath) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-xl text-lg shadow-lg">
        <FileText className="mr-2 h-6 w-6" />
        Select a file to edit
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col rounded-lg border shadow-lg">
      <div className="flex items-center gap-1 p-2">
        <Badge variant="outline" className="flex w-80 shrink-0 items-center gap-1 overflow-hidden px-2 py-1 font-mono text-xs">
          <FileText className="h-4 w-4 flex-none text-gray-500" />
          <span className="truncate" title={filePath}>{filePath}</span>
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="ml-2 h-8 w-8 rounded-full p-0"
              onClick={save}
              disabled={saving || !changed}
              variant={changed ? 'default' : 'outline'}
              size="icon"
              aria-label={saving ? 'Saving...' : changed ? 'Save' : 'Saved'}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>{saving ? 'Saving...' : changed ? 'Save' : 'Saved'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 rounded-full p-0"
              onClick={async () => {
                if (!filePath) return
                setResetting(true)
                try { await fetchServerContent({ showSkeleton: false }) } finally { setResetting(false) }
              }}
              disabled={!changed || loading || saving || resetting}
              variant={changed ? 'destructive' : 'outline'}
              size="icon"
              aria-label={resetting ? 'Resetting...' : 'Reset'}
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>{resetting ? 'Resetting...' : 'Reset'}</TooltipContent>
        </Tooltip>
        {extraActions ? <div className="ml-2 flex items-center gap-1">{extraActions}</div> : null}
        {error && <span className="ml-4 text-xs text-red-500">{error}</span>}
      </div>
      <div className="min-h-0 flex-1 rounded-lg">
        {loading ? (
          <Skeleton className="h-[60vh] w-full rounded-lg" />
        ) : (
          <div className="flex h-full rounded-lg p-1 shadow-lg">
            {/* @ts-ignore dynamic component type */}
            <MonacoEditor
              height="100%"
              defaultLanguage="typescript"
              language="typescript"
              theme={editorTheme as any}
              value={content}
              onMount={handleMount}
              // Give the model a stable file:// URI to avoid inmemory:// paths
              path={`file:///${(filePath || 'untitled.ts').replace(/^\/+/, '')}`}
              options={options}
              onChange={(val) => {
                const next = val ?? ''
                setContent(next)
                const dirty = next !== originalRef.current
                setChanged(dirty)
                onContentChange?.(next, { dirty, filePath })
                scheduleAttachImports(next)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
})

export default MonacoScriptEditor
