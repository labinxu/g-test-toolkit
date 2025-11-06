'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '@/app/context/session-context'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import DirectoryTree from '@/components/files/directory-tree'
import { useReportsPageCache } from '../page-cache'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Page() {
  const hasCache = useReportsPageCache((state) => state.hasCache)
  const cachedCurrentFile = useReportsPageCache((state) => state.currentFile)
  const cachedCurrentDir = useReportsPageCache((state) => state.currentDir)
  const cachedRefreshKey = useReportsPageCache((state) => state.refreshKey)
  const saveCache = useReportsPageCache((state) => state.save)

  const [iframeSrc, setIframeSrc] = useState<string | undefined>(undefined)
  const blobUrlRef = useRef<string | null>(null)
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [metaPanelOpen, setMetaPanelOpen] = useState(false)

  const currentFile = useMemo(() => {
    if (hasCache && cachedCurrentFile) return cachedCurrentFile
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('gtt:reports:lastFile') || ''
      } catch {}
    }
    return ''
  }, [hasCache, cachedCurrentFile])

  const currentDir = useMemo(() => {
    if (hasCache && cachedCurrentDir) return cachedCurrentDir
    if (currentFile) {
      const idx = currentFile.lastIndexOf('/')
      if (idx > 0) return currentFile.slice(0, idx)
    }
    return 'reports'
  }, [hasCache, cachedCurrentDir, currentFile])

  const refreshKey = useMemo(() => (hasCache ? cachedRefreshKey : 0), [hasCache, cachedRefreshKey])
  const { isAuthenticated } = useSession()

  useEffect(() => {
    if (hasCache) return
    let initialFile = ''
    try {
      initialFile = localStorage.getItem('gtt:reports:lastFile') || ''
    } catch {}
    let initialDir = 'reports'
    if (initialFile) {
      const idx = initialFile.lastIndexOf('/')
      if (idx > 0) initialDir = initialFile.slice(0, idx)
    }
    saveCache({
      currentFile: initialFile,
      currentDir: initialDir,
      refreshKey: 0,
      fileCache: {},
    })
  }, [hasCache, saveCache])

  useEffect(
    () => () => {
      if (blobUrlRef.current) {
        try {
          URL.revokeObjectURL(blobUrlRef.current)
        } catch {}
        blobUrlRef.current = null
      }
    },
    []
  )

  const setBlobContent = useCallback((html: string | undefined) => {
    if (blobUrlRef.current) {
      try {
        URL.revokeObjectURL(blobUrlRef.current)
      } catch {}
      blobUrlRef.current = null
    }
    if (html == null) {
      setIframeSrc(undefined)
      return
    }
    try {
      const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      blobUrlRef.current = blobUrl
      setIframeSrc(blobUrl)
    } catch {
      setIframeSrc(undefined)
    }
  }, [])

  const updateFileCache = useCallback(
    (filePath: string, html: string | null) => {
      const current = useReportsPageCache.getState().fileCache || {}
      if (html === null) {
        if (current[filePath] !== undefined) {
          const next = { ...current }
          delete next[filePath]
          saveCache({ fileCache: next })
        }
      } else if (current[filePath] !== html) {
        saveCache({ fileCache: { ...current, [filePath]: html } })
      }
    },
    [saveCache]
  )

  useEffect(() => {
    if (!isAuthenticated) return
    if (!currentFile) {
      setBlobContent(undefined)
      return
    }
    if (!/\.html?$/i.test(currentFile)) {
      setBlobContent(undefined)
      return
    }

    const cachedHtml = useReportsPageCache.getState().fileCache?.[currentFile]
    if (cachedHtml) setBlobContent(cachedHtml)
    else setBlobContent(undefined)

    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`/api/files/read?path=${encodeURIComponent(currentFile)}`, {
          method: 'GET',
          credentials: 'include',
        })
        if (!response.ok) {
          if (!cancelled) {
            if (response.status === 404) updateFileCache(currentFile, null)
            setBlobContent(undefined)
          }
          return
        }
        const content = await response.text()
        if (cancelled) return
        updateFileCache(currentFile, content)
        setBlobContent(content)
      } catch (error) {
        if (!cancelled) setBlobContent(undefined)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentFile, isAuthenticated, setBlobContent, updateFileCache])

  useEffect(() => {
    if (!currentFile || !/\.html?$/i.test(currentFile)) {
      setMeta(null)
      setMetaError(null)
      return
    }
    const metaPath = currentFile.replace(/\.html?$/i, '.json')
    let cancelled = false
    const loadMeta = async () => {
      setMetaLoading(true)
      setMetaError(null)
      try {
        const res = await fetch(`/api/files/read?path=${encodeURIComponent(metaPath)}`, {
          method: 'GET',
          credentials: 'include',
        })
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setMeta(null)
            return
          }
          const text = await res.text().catch(() => '')
          throw new Error(text || res.statusText)
        }
        const text = await res.text()
        const parsed = JSON.parse(text) as ReportMeta
        if (!cancelled) setMeta(parsed)
      } catch (err: any) {
        if (!cancelled) {
          setMeta(null)
          setMetaError(err?.message || 'Failed to load metadata')
        }
      } finally {
        if (!cancelled) setMetaLoading(false)
      }
    }
    loadMeta()
    return () => {
      cancelled = true
    }
  }, [currentFile])

  const failedArtifacts = useMemo(() => {
    if (!meta?.cases) return [] as FailedArtifact[]
    const list: FailedArtifact[] = []
    meta.cases.forEach((c) => {
      if ((c.status || '').toLowerCase() !== 'failed') return
      c.artifacts?.forEach((art) => {
        if (!art?.path) return
        if (art.kind && art.kind !== 'screenshot') return
        list.push({
          caseName: c.name || `Case ${c.index + 1}`,
          description: art.description || 'Screenshot',
          path: art.path,
        })
      })
    })
    return list
  }, [meta])

  useEffect(() => {
    if (failedArtifacts.length > 0) setMetaPanelOpen(true)
  }, [failedArtifacts])

  const handleSelectFile = useCallback(
    (filePath: string) => {
      saveCache({ currentFile: filePath })
      if (filePath) {
        try {
          localStorage.setItem('gtt:reports:lastFile', filePath)
        } catch {}
      }
    },
    [saveCache]
  )

  const handleSelectDir = useCallback(
    (dirPath: string) => {
      saveCache({ currentDir: dirPath })
    },
    [saveCache]
  )

  const handleRefreshKey = useCallback(
    (value: number) => {
      saveCache({ refreshKey: value })
    },
    [saveCache]
  )

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen min-h-0 w-full flex-1 gap-0 rounded-lg">
      <div className="flex h-full flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel collapsible={false}>
          <DirectoryTree
            currentDir={currentDir}
            refreshKey={refreshKey}
            setRefreshKey={handleRefreshKey}
            onSelect={handleSelectFile}
            onDirSelect={handleSelectDir}
            collapsible={false}
          />
        </DirectoryTreePanel>
      </div>
      <div className="flex h-full min-w-0 flex-1 flex-row gap-3 pl-4 transition-all duration-300">
        <div className="flex min-w-0 flex-1 flex-col">
          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              className="h-full w-full rounded border"
              title="Preview"
              style={{ flex: 1, minHeight: 0 }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400">
              Select HTML File to view.
            </div>
          )}
        </div>
        <div
          className={cn(
            'bg-background relative z-10 flex flex-none overflow-hidden rounded-lg border',
            metaPanelOpen ? 'p-2 shadow-lg' : 'p-1'
          )}
          style={{
            width: metaPanelOpen ? 360 : 36,
            transition: 'width 240ms ease',
          }}
        >
          <div className="self-center">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 rounded-full border p-0 shadow"
              onClick={() => setMetaPanelOpen((v) => !v)}
              aria-expanded={metaPanelOpen}
              type="button"
            >
              {metaPanelOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </Button>
          </div>
          {metaPanelOpen ? (
            <div className="ml-2 flex h-full flex-1 flex-col">
              <div className="flex items-center justify-between border-b pb-1 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Failed screenshots
                  {metaLoading ? ' (loading...)' : ''}
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-3 py-2 pr-1">
                  {metaError ? (
                    <div className="text-xs text-red-500">{metaError}</div>
                  ) : failedArtifacts.length === 0 ? (
                    <div className="text-muted-foreground text-xs">No failed screenshots</div>
                  ) : (
                    failedArtifacts.map((item, idx) => (
                      <div key={`${item.path}-${idx}`} className="space-y-1">
                        <div className="truncate text-xs font-semibold" title={item.caseName}>
                          {item.caseName}
                        </div>
                        <div
                          className="text-muted-foreground truncate text-[11px]"
                          title={item.description}
                        >
                          {item.description}
                        </div>
                        <div className="overflow-hidden rounded border bg-black/5">
                          <img
                            src={`/api/files/raw?path=${encodeURIComponent(item.path)}`}
                            alt={item.description || item.caseName}
                            className="h-auto w-full"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type ReportMeta = {
  testName: string
  generatedAt: string
  reportHtml?: string
  cases?: Array<{
    index: number
    name?: string
    status?: string
    durationMs?: number
    error?: string
    metadata?: Record<string, any>
    artifacts?: Array<{ path: string; description?: string; kind?: string }>
  }>
  artifacts?: Array<{ path: string; description?: string; kind?: string }>
}

type FailedArtifact = {
  caseName: string
  description: string
  path: string
}
