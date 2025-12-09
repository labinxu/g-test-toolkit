'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '@/app/context/session-context'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import DirectoryTree, { type FileNode, type DirectoryTreeAction } from '@/components/files/directory-tree'
import { useReportsPageCache } from '../page-cache'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { OptionsSelectSearch } from '@/components/select/options-select-search'
import type { OptionsSelectItem } from '@/components/select/options-select'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function Page() {
  const hasCache = useReportsPageCache((state) => state.hasCache)
  const cachedCurrentFile = useReportsPageCache((state) => state.currentFile)
  const cachedCurrentDir = useReportsPageCache((state) => state.currentDir)
  const cachedRefreshKey = useReportsPageCache((state) => state.refreshKey)
  const saveCache = useReportsPageCache((state) => state.save)
  const resetCache = useReportsPageCache((state) => state.reset)

  const [iframeSrc, setIframeSrc] = useState<string | undefined>(undefined)
  const blobUrlRef = useRef<string | null>(null)
  const [meta, setMeta] = useState<ReportMeta | null>(null)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [metaPanelOpen, setMetaPanelOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [treeFilePaths, setTreeFilePaths] = useState<string[]>([])

  const { isAuthenticated, user } = useSession()

  const username = user?.username || ''
  const userReportsDir = useMemo(
    () => (username ? `users/${username}/reports` : 'reports'),
    [username]
  )
  const [selectedRoot, setSelectedRoot] = useState<string>(userReportsDir)
  const lastFileStorageKey = useMemo(
    () => (username ? `gtt:reports:lastFile:${username}` : 'gtt:reports:lastFile'),
    [username]
  )
  const rootOptions = useMemo<OptionsSelectItem<string>[]>(() => {
    const list: OptionsSelectItem<string>[] = []
    const add = (value: string, label: string) => {
      if (list.some((i) => i.value === value)) return
      list.push({ value, label })
    }
    add(userReportsDir, username ? `${username} reports` : 'My reports')
    add('reports', 'Shared reports')
    if (cachedCurrentDir) add(cachedCurrentDir, cachedCurrentDir)
    return list
  }, [userReportsDir, username, cachedCurrentDir])

  const currentFile = useMemo(() => {
    if (hasCache && cachedCurrentFile) return cachedCurrentFile
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(lastFileStorageKey) || ''
      } catch {}
    }
    return ''
  }, [hasCache, cachedCurrentFile, lastFileStorageKey])

  const currentDir = useMemo(() => {
    if (hasCache && cachedCurrentDir) return cachedCurrentDir
    if (currentFile) {
      const idx = currentFile.lastIndexOf('/')
      if (idx > 0) return currentFile.slice(0, idx)
    }
    return userReportsDir
  }, [hasCache, cachedCurrentDir, currentFile, userReportsDir])

  const refreshKey = useMemo(() => (hasCache ? cachedRefreshKey : 0), [hasCache, cachedRefreshKey])

  useEffect(() => {
    if (currentDir && currentDir !== selectedRoot) {
      setSelectedRoot(currentDir)
    }
  }, [currentDir, selectedRoot])

  const lastUserRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastUserRef.current && lastUserRef.current !== username) {
      resetCache()
      setSelectedPaths([])
      setTreeFilePaths([])
      setSelectedRoot(userReportsDir)
    }
    lastUserRef.current = username || null
  }, [username, resetCache, userReportsDir])

  useEffect(() => {
    if (hasCache) return
    let initialFile = ''
    try {
      initialFile = localStorage.getItem(lastFileStorageKey) || ''
    } catch {}
    let initialDir = userReportsDir
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
    setSelectedRoot(initialDir)
  }, [hasCache, saveCache, lastFileStorageKey, userReportsDir])

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
          localStorage.setItem(lastFileStorageKey, filePath)
        } catch {}
      } else {
        try {
          localStorage.removeItem(lastFileStorageKey)
        } catch {}
      }
    },
    [saveCache, lastFileStorageKey]
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
  const handleRootChange = useCallback(
    (value: string) => {
      setSelectedRoot(value)
      setSelectedPaths([])
      setTreeFilePaths([])
      saveCache({ currentDir: value, currentFile: '', refreshKey: (refreshKey || 0) + 1, fileCache: {} })
      setBlobContent(undefined)
      setMeta(null)
      setMetaError(null)
    },
    [refreshKey, saveCache, setBlobContent]
  )

  const handleDeletedReport = useCallback(
    (filePath: string) => {
      if (filePath !== currentFile) return
      saveCache({ currentFile: '' })
      setBlobContent(undefined)
      setMeta(null)
      setMetaError(null)
      try {
        localStorage.removeItem(lastFileStorageKey)
      } catch {}
    },
    [currentFile, saveCache, setBlobContent, lastFileStorageKey]
  )

  const handleDeleteNode = useCallback((node: FileNode) => {
    if (!node || node.isDirectory) return
    setDeleteTarget(node)
  }, [])

  const performDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: deleteTarget.path }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Delete failed')
      }
      handleDeletedReport(deleteTarget.path)
      handleRefreshKey(refreshKey + 1)
      toast.success('Delete succeeded')
    } catch (e: any) {
      const msg = e?.message || 'Delete failed'
      toast.error(msg)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget, handleDeletedReport, handleRefreshKey, refreshKey])

  const handleToggleSelect = useCallback(
    (node: FileNode, checked: boolean) => {
      if (node.isDirectory) return
      setSelectedPaths((prev) => {
        const set = new Set(prev)
        if (checked) set.add(node.path)
        else set.delete(node.path)
        return Array.from(set)
      })
    },
    []
  )

  const flattenFiles = useCallback((nodes: FileNode[] = []) => {
    const paths: string[] = []
    const walk = (list: FileNode[]) => {
      list.forEach((n) => {
        if (n.isDirectory && n.children?.length) {
          walk(n.children)
        } else if (!n.isDirectory) {
          paths.push(n.path)
        }
      })
    }
    walk(nodes)
    return paths
  }, [])

  const handleTreeData = useCallback(
    (nodes: FileNode[]) => {
      const files = flattenFiles(nodes)
      setTreeFilePaths(files)
      setSelectedPaths((prev) => prev.filter((p) => files.includes(p)))
    },
    [flattenFiles]
  )

  const allSelected = treeFilePaths.length > 0 && selectedPaths.length === treeFilePaths.length
  const partialSelected = selectedPaths.length > 0 && !allSelected

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      if (checked) setSelectedPaths(treeFilePaths)
      else setSelectedPaths([])
    },
    [treeFilePaths]
  )

  const handleDeleteSelected = useCallback(async () => {
    const targets = selectedPaths.filter(Boolean)
    if (!targets.length) return
    setDeleting(true)
    try {
      let success = 0
      for (const path of targets) {
        const res = await fetch('/api/files/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path }),
        })
        if (res.ok) success += 1
      }
      setSelectedPaths([])
      handleRefreshKey(refreshKey + 1)
      if (targets.includes(currentFile)) {
        handleDeletedReport(currentFile)
      }
      toast.success(`Deleted ${success}/${targets.length} file(s)`)
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }, [selectedPaths, handleRefreshKey, refreshKey, currentFile, handleDeletedReport])

  const nodeActions = useCallback(
    (node: FileNode): DirectoryTreeAction[] => {
      if (node.isDirectory) return []
      return [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          danger: true,
          onSelect: () => handleDeleteNode(node),
        },
      ]
    },
    [handleDeleteNode]
  )

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen min-h-0 w-full flex-1 gap-0 rounded-lg">
      <div className="flex h-full flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel collapsible={false}>
          <div className="mb-2 flex items-center gap-2">
            <OptionsSelectSearch
              size="sm"
              placeholder="选择目录"
              value={selectedRoot}
              onChange={handleRootChange}
              items={rootOptions}
              className="w-48"
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="reports-select-all"
                checked={allSelected || (partialSelected ? 'indeterminate' : false)}
                onCheckedChange={(v) => handleToggleAll(v === true)}
                disabled={treeFilePaths.length === 0}
              />
              <label htmlFor="reports-select-all" className="select-none text-sm">
                全选
              </label>
            </div>
            <Button
              variant="destructive"
              size="icon"
              disabled={!selectedPaths.length || deleting}
              className="h-8 w-8"
              onClick={handleDeleteSelected}
              title="删除选中的报告"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <DirectoryTree
            currentDir={currentDir}
            refreshKey={refreshKey}
            onSelect={handleSelectFile}
            onDirSelect={handleSelectDir}
            collapsible={false}
            nodeActions={nodeActions}
            selectablePredicate={(node) => !node.isDirectory}
            selectedPaths={selectedPaths}
            onToggleSelect={handleToggleSelect}
            onTreeData={handleTreeData}
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
                          <Image
                            src={`/api/files/raw?path=${encodeURIComponent(item.path)}`}
                            alt={item.description || item.caseName}
                            width={360}
                            height={720}
                            unoptimized
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <b>{deleteTarget?.path}</b>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={performDelete}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
