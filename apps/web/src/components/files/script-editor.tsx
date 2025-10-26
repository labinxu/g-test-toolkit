'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
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

interface ScriptEditorProps {
  filePath: string
  cachedValue?: CachedFileEntry
  onContentChange?: (value: string, info?: { dirty: boolean; filePath: string }) => void
  onContentLoaded?: (payload: CachedFileEntry, context: { filePath: string }) => void
  onContentSaved?: (payload: CachedFileEntry, context: { filePath: string }) => void
}

export function ScriptEditor({
  filePath,
  cachedValue,
  onContentChange,
  onContentLoaded,
  onContentSaved,
}: ScriptEditorProps) {
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
        <Badge variant="outline" className="flex items-center px-2 py-1 font-mono text-xs">
          <FileText className="mr-1 h-4 w-4 text-gray-500" />
          {filePath}
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
              extensions={[...extensions, roundedTheme]}
              theme={theme === 'dark' ? 'dark' : 'light'}
              editable={!(loading || saving)}
              basicSetup={{
                autocompletion: true,
                highlightActiveLine: true,
                foldGutter: true,
              }}
              className="h-full w-full flex-1"
              style={{ height: '100%', width: '100%' }}
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
}
