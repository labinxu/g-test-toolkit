'use client'
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Save, Loader2, RotateCcw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/app/context/session-context'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { useTheme } from 'next-themes'

type CachedFileEntry = {
  content: string
  original: string
}

export type ScriptEditorHandle = {
  insertAtCursor: (text: string, opts?: { ensureNewLine?: boolean }) => void
  getCursor: () => number | null
  setCursor: (pos: number) => void
}

interface ScriptEditorProps {
  filePath: string
  cachedValue?: CachedFileEntry
  onContentChange?: (value: string, info?: { dirty: boolean; filePath: string }) => void
  onContentLoaded?: (payload: CachedFileEntry, context: { filePath: string }) => void
  onContentSaved?: (payload: CachedFileEntry, context: { filePath: string }) => void
  extraActions?: ReactNode
  /** Soft wrap at given column (visual only). If provided, editor wraps lines at this column. */
  wrapAtColumn?: number
}

export const ScriptEditor = forwardRef<ScriptEditorHandle, ScriptEditorProps>(function ScriptEditor(
  {
    filePath,
    cachedValue,
    onContentChange,
    onContentLoaded,
    onContentSaved,
    extraActions,
    wrapAtColumn,
  }: ScriptEditorProps,
  ref
) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [changed, setChanged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>('typescript')
  const lastLoadedPath = useRef<string | null>(null)
  const [content, setContent] = useState('')
  const originalContentRef = useRef<string>('')
  const { isAuthenticated } = useSession()
  const { theme } = useTheme()
  const extensions = useMemo(() => {
    if (language === 'bash') {
      return []
    }
    return [javascript({ typescript: true })]
  }, [language])
  const roundedTheme = useMemo(
    () =>
      EditorView.theme({
        '&': { borderRadius: 'var(--radius-lg, 0.5rem)', overflow: 'hidden' },
        '.cm-scroller': { borderRadius: 'var(--radius-lg, 0.5rem)' },
      }),
    []
  )
  const rulerTheme = useMemo(() => {
    const col = typeof wrapAtColumn === 'number' ? wrapAtColumn : 80
    const W = Math.max(10, Math.min(240, col | 0))
    return EditorView.theme({
      '.cm-content': { position: 'relative' },
      '.cm-content::after': {
        content: '""',
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: `${W}ch`,
        width: '1px',
        background: 'rgba(127,127,127,0.25)',
        pointerEvents: 'none',
      },
    })
  }, [wrapAtColumn])
  const makeWrapTheme = useCallback((col: number) => {
    const W = Math.max(10, Math.min(240, col | 0))
    return EditorView.theme({
      '.cm-content': {
        // Limit content width so lineWrapping wraps at this column, but not smaller than viewport
        maxWidth: `${W}ch`,
      },
    })
  }, [])
  const viewRef = useRef<EditorView | null>(null)
  const lastCursorRef = useRef<number>(0)
  const pendingCursorRef = useRef<number | null>(null)
  const appliedCursorForFileRef = useRef<string | null>(null)
  // No content clamping — visual soft wrap is applied in the editor when requested
  const fetchServerContent = useCallback(
    async (options?: { showSkeleton?: boolean }) => {
      if (!filePath || !isAuthenticated) return
      const showSkeleton = options?.showSkeleton ?? true
      if (showSkeleton) {
        setLoading(true)
      }
      setError(null)
      try {
        const res = await fetch(`/api/files/script?path=${encodeURIComponent(filePath)}`, {
          method: 'get',
          credentials: 'include',
        })
        if (!res.ok) {
          throw new Error(await res.text())
        }
        const data = await res.json()
        const nextContent = data['content'] ?? ''
        setContent(nextContent)
        originalContentRef.current = nextContent
        setChanged(false)
        lastLoadedPath.current = filePath
        onContentLoaded?.({ content: nextContent, original: nextContent }, { filePath })
        onContentChange?.(nextContent, { dirty: false, filePath })
      } catch (e: any) {
        setError(e?.message || 'Loading failed')
        return false
      } finally {
        if (showSkeleton) {
          setLoading(false)
        }
      }
      return true
    },
    [filePath, isAuthenticated, onContentChange, onContentLoaded]
  )

  // Load file content (with cache support)
  useEffect(() => {
    if (!filePath || !isAuthenticated) {
      return
    }

    if (cachedValue) {
      setLoading(false)
      setError(null)
      setContent(cachedValue.content)
      originalContentRef.current = cachedValue.original
      setChanged(cachedValue.content !== cachedValue.original)
      lastLoadedPath.current = filePath
      return
    }

    fetchServerContent({ showSkeleton: true })
  }, [filePath, cachedValue, isAuthenticated, fetchServerContent])

  // Restore caret position per file from localStorage
  useEffect(() => {
    if (!filePath) return
    if (appliedCursorForFileRef.current === filePath) return
    try {
      const raw = localStorage.getItem(`gtt:cursor:${filePath}`)
      if (!raw) {
        appliedCursorForFileRef.current = filePath
        return
      }
      const pos = parseInt(raw, 10)
      if (Number.isFinite(pos)) {
        const clamped = Math.max(0, Math.min(pos, content.length))
        lastCursorRef.current = clamped
        // If view exists, move now; else apply on first update
        if (viewRef.current) {
          try {
            viewRef.current.dispatch({ selection: { anchor: clamped } })
          } catch {}
        } else {
          pendingCursorRef.current = clamped
        }
      }
    } catch {}
    appliedCursorForFileRef.current = filePath
  }, [filePath, content])

  // Save file
  async function save() {
    if (!filePath) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath, content }),
      })
      if (!res.ok) throw new Error('Save Failed')
      setChanged(false)
      originalContentRef.current = content
      onContentSaved?.({ content, original: content }, { filePath })
      onContentChange?.(content, { dirty: false, filePath })
    } catch (e: any) {
      setError(e.message || 'Save Failed')
    } finally {
      setSaving(false)
    }
  }

  // Expose imperative API
  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor: (text: string, opts?: { ensureNewLine?: boolean }) => {
        const view = viewRef.current
        const needsLF = !!opts?.ensureNewLine
        const insertText = needsLF ? `${text}\n` : text
        if (view) {
          // Use live selection from view to avoid stale cursor
          const head = view.state?.selection?.main?.head ?? lastCursorRef.current ?? 0
          const pos = Math.max(0, Math.min(head, view.state.doc.length))
          const nextPos = pos + insertText.length
          view.dispatch({ changes: { from: pos, to: pos, insert: insertText }, selection: { anchor: nextPos } })
          // Focus after dispatch and again on next frame to ensure focus sticks
          try { view.focus() } catch {}
          try { requestAnimationFrame(() => { try { view.focus(); view.dispatch({ selection: { anchor: nextPos } }) } catch {} }) } catch {}
          lastCursorRef.current = nextPos
          try { localStorage.setItem(`gtt:cursor:${filePath}`, String(nextPos)) } catch {}
        } else {
          const currentPos = typeof lastCursorRef.current === 'number' ? lastCursorRef.current : 0
          const pos = Math.max(0, Math.min(currentPos, content.length))
          const next = content.slice(0, pos) + insertText + content.slice(pos)
          setContent(next)
          const dirty = next !== originalContentRef.current
          setChanged(dirty)
          onContentChange?.(next, { dirty, filePath })
          const nextPos = pos + insertText.length
          lastCursorRef.current = nextPos
          pendingCursorRef.current = nextPos
        }
      },
      getCursor: () => (typeof lastCursorRef.current === 'number' ? lastCursorRef.current : null),
      setCursor: (pos: number) => {
        const nextPos = Math.max(0, Math.min(pos, content.length))
        lastCursorRef.current = nextPos
        try {
          viewRef.current?.focus()
          viewRef.current?.dispatch({ selection: { anchor: nextPos } })
        } catch {}
      },
    }),
    [content, filePath, onContentChange]
  )

  // Ctrl+S/Cmd+S 快捷保存
  useEffect(() => {
    if (filePath.endsWith('ts')) {
      setLanguage('typescript')
    } else if (filePath.endsWith('sh')) {
      setLanguage('bash')
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (!filePath || !changed || saving) return
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filePath, changed, saving, content])

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
        <Badge
          variant="outline"
          className="flex w-80 shrink-0 items-center gap-1 overflow-hidden px-2 py-1 font-mono text-xs"
        >
          <FileText className="h-4 w-4 flex-none text-gray-500" />
          <span className="truncate" title={filePath}>
            {filePath}
          </span>
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
          <TooltipContent sideOffset={6}>
            {saving ? 'Saving...' : changed ? 'Save' : 'Saved'}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-8 w-8 rounded-full p-0"
              onClick={async () => {
                if (!filePath) return
                setResetting(true)
                try {
                  await fetchServerContent({ showSkeleton: false })
                } finally {
                  setResetting(false)
                }
              }}
              disabled={!changed || loading || saving || resetting}
              variant={changed ? 'destructive' : 'outline'}
              size="icon"
              aria-label={resetting ? 'Resetting...' : 'Reset'}
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>{resetting ? 'Resetting...' : 'Reset'}</TooltipContent>
        </Tooltip>
        {/* Extra actions injected by parent, placed after Reset */}
        {extraActions ? <div className="ml-2 flex items-center gap-1">{extraActions}</div> : null}
        {error && <span className="ml-4 text-xs text-red-500">{error}</span>}
      </div>
      <div className="min-h-0 flex-1 rounded-lg">
        {loading ? (
          <Skeleton className="h-[60vh] w-full rounded-lg" />
        ) : (
          <div className="flex h-full rounded-lg p-1 shadow-lg">
            <CodeMirror
              height="100%"
              value={content}
              extensions={
                [
                  ...extensions,
                  roundedTheme,
                  rulerTheme,
                  ...(typeof wrapAtColumn === 'number'
                    ? [EditorView.lineWrapping, makeWrapTheme(wrapAtColumn)]
                    : []),
                ]
              }
              theme={theme === 'dark' ? 'dark' : 'light'}
              editable={!(loading || saving)}
              basicSetup={{
                autocompletion: true,
                highlightActiveLine: true,
                foldGutter: true,
              }}
              className="h-full w-full flex-1"
              style={{ height: '100%', width: '100%' }}
              onUpdate={(vu) => {
                // Track view instance and caret
                // @ts-ignore view exists on update
                const v: EditorView | undefined = (vu as any)?.view
                if (v) viewRef.current = v
                try {
                  const head = vu.state?.selection?.main?.head
                  if (typeof head === 'number') {
                    lastCursorRef.current = head
                    try {
                      if (filePath) localStorage.setItem(`gtt:cursor:${filePath}`, String(head))
                    } catch {}
                  }
                  // Apply pending cursor for this file once view is ready
                  if (pendingCursorRef.current != null) {
                    const pos = Math.max(0, Math.min(pendingCursorRef.current, vu.state.doc.length))
                    viewRef.current?.dispatch({ selection: { anchor: pos } })
                    pendingCursorRef.current = null
                  }
                } catch {}
              }}
              onChange={(value) => {
                const nextValue = value ?? ''
                setContent(nextValue)
                const dirty = nextValue !== originalContentRef.current
                setChanged(dirty)
                onContentChange?.(nextValue, { dirty, filePath })
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
})
