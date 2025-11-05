'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import MonacoScriptEditor, {
  type MonacoScriptEditorHandle,
} from '@/components/files/monaco-script-editor'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  RefreshCw,
  Play,
  PackagePlus,
  SlidersHorizontal,
  Activity,
  Braces,
  RouteOff,
  Unplug,
  Server,
  ServerOff,
  Smartphone,
  Check,
} from 'lucide-react'
import { AppiumToggleButton } from '@/components/appium-toggle-button'
// removed Switch in favor of icon toggle for Keep App Open
import { OutputPanel } from '@/components/output-panel'
import { useSocket } from './socket-content'
import NewFileOrFolder from '@/components/files/new-file-folder'
import DirectoryTree from './files/directory-tree'
import { toast } from 'sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ParametersForm, type ParametersFormHandle } from '@/components/settings/parameters-form'
import { useTestcasesPageCache } from '../page-cache'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function Page() {
  const tcCache = useTestcasesPageCache()
  const [currentFile, setCurrentFile] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('gtt:testcases:lastFile') || ''
    } catch {
      return ''
    }
  })
  const [currentDir, setCurrentDir] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      const last = localStorage.getItem('gtt:testcases:lastFile') || ''
      const i = last.lastIndexOf('/')
      return i > 0 ? last.slice(0, i) : ''
    } catch {
      return ''
    }
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const editorRef = useRef<MonacoScriptEditorHandle | null>(null)
  const [typesOpen, setTypesOpen] = useState(false)
  const [typesGlobal, setTypesGlobal] = useState<string[]>([])
  const [typesRelatives, setTypesRelatives] = useState<string[]>([])
  const updateTypesStatus = useCallback(() => {
    try {
      const s = editorRef.current?.getTypingsStatus?.()
      setTypesGlobal(s?.global || [])
      setTypesRelatives(s?.relatives || [])
    } catch {}
  }, [])
  useEffect(() => {
    if (typesOpen) updateTypesStatus()
  }, [typesOpen, updateTypesStatus])
  const [openLog, setOpenLog] = useState(false)
  const { logs, connected, clientId, clearLogs, running, setRunning } = useSocket()
  const [fileCache, setFileCache] = useState<Record<string, { content: string; original: string }>>(
    {}
  )
  const [appiumAutoRefresh, setAppiumAutoRefresh] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:testcases:appiumAutoRefresh')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [keepAppOpen, setKeepAppOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:testcases:keepAppOpen')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })
  // Share session by selected deviceId stored by Libs page
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('gtt:selectedDeviceId') || ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    try {
      if (selectedDeviceId) localStorage.setItem('gtt:selectedDeviceId', selectedDeviceId)
      else localStorage.removeItem('gtt:selectedDeviceId')
    } catch {}
  }, [selectedDeviceId])
  useEffect(() => {
    const onStorage = () => {
      try {
        setSelectedDeviceId(localStorage.getItem('gtt:selectedDeviceId') || '')
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('gtt-parameters-updated', onStorage as any)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('gtt-parameters-updated', onStorage as any)
    }
  }, [])
  const [confirmCloseMineOpen, setConfirmCloseMineOpen] = useState(false)
  const [confirmCloseAllOpen, setConfirmCloseAllOpen] = useState(false)
  const [deviceIds, setDeviceIds] = useState<string[]>([])
  useEffect(() => {
    const handler = () => {
      try {
        const v = localStorage.getItem('gtt:testcases:appiumAutoRefresh')
        setAppiumAutoRefresh(v == null ? true : v === '1' || v === 'true')
      } catch {}
    }
    window.addEventListener('storage', handler)
    window.addEventListener('gtt-parameters-updated', handler as any)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('gtt-parameters-updated', handler as any)
    }
  }, [])
  // Poll device list when auto refresh is enabled
  useEffect(() => {
    let id: any
    const fetchDevices = async () => {
      try {
        const res = await fetch('/api/android/devices', {
          credentials: 'include',
        })
        if (!res.ok) return
        const j = (await res.json()) as { devices?: string }
        const output = j?.devices ?? ''
        const ids = output
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && /\bdevice$/.test(l))
          .map((l) => l.split(/\s+/)[0])
        setDeviceIds(ids)
        if (ids.length && !ids.includes(selectedDeviceId)) setSelectedDeviceId(ids[0])
        if (!ids.length) setSelectedDeviceId('')
      } catch {}
    }
    fetchDevices()
    if (appiumAutoRefresh) id = setInterval(fetchDevices, 5000)
    return () => id && clearInterval(id)
  }, [appiumAutoRefresh, selectedDeviceId])
  const paramsRef = useRef<ParametersFormHandle | null>(null)
  // Directory tree cache settings (global)
  const [dirCacheDisabled, setDirCacheDisabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('gtt:dirTree:disable') === '1'
    } catch {
      return false
    }
  })
  const [dirCacheTtlMs, setDirCacheTtlMs] = useState<number>(() => {
    if (typeof window === 'undefined') return 60000
    try {
      const v = parseInt(localStorage.getItem('gtt:dirTree:ttl') || '60000', 10)
      return Number.isFinite(v) ? v : 60000
    } catch {
      return 60000
    }
  })
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.storageArea) return
      if (e.key === 'gtt:dirTree:disable') {
        try {
          setDirCacheDisabled(localStorage.getItem('gtt:dirTree:disable') === '1')
        } catch {}
      }
      if (e.key === 'gtt:dirTree:ttl') {
        try {
          const v = parseInt(localStorage.getItem('gtt:dirTree:ttl') || '60000', 10)
          setDirCacheTtlMs(Number.isFinite(v) ? v : 60000)
        } catch {}
      }
      if (e.key === 'gtt:dirTree:cleared') {
        setRefreshKey((k) => k + 1)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  // Auto refresh typings on build completion messages
  const lastTypingsReloadIdxRef = useRef<number>(0)
  useEffect(() => {
    const start = Math.max(0, lastTypingsReloadIdxRef.current)
    const L = logs?.length || 0
    const pattern = /libs build complete/i
    for (let i = start; i < L; i++) {
      const msg = logs[i] || ''
      if (pattern.test(msg)) {
        try {
          setTimeout(() => editorRef.current?.reloadTypings?.(), 200)
        } catch {}
        lastTypingsReloadIdxRef.current = L
        break
      }
    }
  }, [logs])
  const runPath = useCallback(async () => {
    clearLogs()
    // 1) fetch csrf token first (cookie must be present and credentials included)
    const csrfResp = await fetch(`/api/csrf-token`, { credentials: 'include' })
    const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null
    const csrfToken = csrf?.token

    // 2) then POST with X-CSRF-Token
    fetch(`/api/testcase/runpath`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify({
        filePath: currentFile,
        clientId,
        keepAppOpen,
        shareSession: true,
        sessionKey: selectedDeviceId || undefined,
      }),
    })
      .then((resp) => {
        if (resp.ok) {
          toast.message('Start succefull...')
          setRunning(true)
        }
      })
      .catch((err) => {
        setRunning(false)
      })
    setOpenLog(true)
  }, [currentFile, clientId])
  const closeKeptSessions = useCallback(async () => {
    try {
      const csrfResp = await fetch(`/api/csrf-token`, {
        credentials: 'include',
      })
      const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null
      const csrfToken = csrf?.token
      const resp = await fetch(`/api/testcase/cleanup-android`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          clientId,
          sessionKey: selectedDeviceId || undefined,
        }),
      })
      if (resp.ok) {
        const data = await resp.json()
        toast.success(`Closed: ${data.closed}, Errors: ${data.errors}`)
      } else {
        toast.error('Cleanup failed')
      }
    } catch (e) {
      toast.error(String(e))
    }
  }, [clientId, selectedDeviceId])
  const closeAllKeptSessions = useCallback(async () => {
    try {
      const csrfResp = await fetch(`/api/csrf-token`, {
        credentials: 'include',
      })
      const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null
      const csrfToken = csrf?.token
      const resp = await fetch(`/api/testcase/cleanup-android`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
      })
      if (resp.ok) {
        const data = await resp.json()
        toast.success(`Closed: ${data.closed}, Errors: ${data.errors}`)
      } else {
        toast.error('Cleanup all failed')
      }
    } catch (e) {
      toast.error(String(e))
    }
  }, [])
  const buildLibs = useCallback(async () => {
    fetch(`/api/testcase/buildlibs?clientId=${clientId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((resp) => {
        if (resp.ok) {
          toast.message('Building...')
        }
      })
      .catch((err) => {
        toast.error(`${err}`)
      })
  }, [clientId])

  const renderLogs = () => {
    return logs.map((log, index) => {
      let color = ''
      try {
        if (log.includes('error') || log.includes('Error')) {
          color = 'red'
        } else if (
          log.includes('success') ||
          log.includes('Success') ||
          log.includes('finished') ||
          log.includes('passed')
        ) {
          color = 'green'
        } else if (log.includes('[info]')) {
          color = '#3B82F6'
        } else if (log.includes('debug')) {
          color = '#6B7280'
        } else if (log.includes('[warn]')) {
          color = '#F59E0B'
        }
      } catch (err) {
        console.log(logs)
        console.log(err)
      }
      return (
        <div key={index} style={{ color, margin: 0 }}>
          {log}
        </div>
      )
    })
  }
  // Restore cached state on mount
  useEffect(() => {
    const s = useTestcasesPageCache.getState()
    if (s.hasCache) {
      setCurrentFile(s.currentFile)
      setCurrentDir(s.currentDir)
      setFileCache(s.fileCache)
      setOpenLog(s.openLog)
    } else {
      // Fallback: restore last opened file from localStorage
      try {
        const last = localStorage.getItem('gtt:testcases:lastFile')
        if (last) {
          setCurrentFile(last)
          const i = last.lastIndexOf('/')
          setCurrentDir(i > 0 ? last.slice(0, i) : '')
          // Bootstrap editor cache for instant show
          const raw = localStorage.getItem(`gtt:fileCache:testcases:${last}`)
          if (raw) {
            try {
              const obj = JSON.parse(raw) as {
                content: string
                original: string
              }
              setFileCache((prev) => ({ ...prev, [last]: obj }))
            } catch {}
          }
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Keep latest state in a ref and save on unmount
  const lastRef = useRef<any>(null)
  useEffect(() => {
    lastRef.current = { currentFile, currentDir, fileCache, openLog }
  }, [currentFile, currentDir, fileCache, openLog])
  useEffect(() => {
    return () => {
      tcCache.save(lastRef.current || {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Persist last opened file for cross-page restore
  useEffect(() => {
    try {
      if (currentFile) localStorage.setItem('gtt:testcases:lastFile', currentFile)
    } catch {}
  }, [currentFile])
  return (
    <div className="flex w-full flex-1 gap-0 rounded-lg">
      <div className="flex h-full flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel>
          <NewFileOrFolder
            key={currentDir}
            parentDir={currentDir}
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
          <DirectoryTree
            api={'/api/testcase/listcases?&depth=3'}
            currentDir={currentDir}
            refreshKey={refreshKey}
            setRefreshKey={setRefreshKey}
            onSelect={setCurrentFile}
            onDirSelect={setCurrentDir}
            selectedPath={currentFile}
            cacheEnabled={!dirCacheDisabled}
            cacheTtlMs={dirCacheTtlMs}
            collapsible={false}
            run={runPath}
          />
        </DirectoryTreePanel>
      </div>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col pl-4 transition-all duration-300">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 justify-between">
            <MonacoScriptEditor
              ref={editorRef}
              filePath={currentFile}
              cachedValue={currentFile ? fileCache[currentFile] : undefined}
              extraActions={
                <div className="flex flex-row">
                  <div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => runPath()}
                          disabled={!currentFile || running}
                          aria-label="Execute"
                        >
                          {running ? (
                            <RefreshCw className={`h-4 w-4 animate-spin text-green-400`} />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {running ? 'Running...' : 'Execute'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="relative ml-1 h-8 w-8 rounded-full"
                              aria-label="Select device"
                            >
                              <Smartphone className="h-4 w-4" />
                              {selectedDeviceId ? (
                                <span
                                  aria-hidden
                                  className="ring-background absolute -top-0.5 -right-0.5 inline-block h-2 w-2 rounded-full bg-green-500 ring-2"
                                />
                              ) : null}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            {deviceIds.length ? (
                              deviceIds.map((id) => (
                                <DropdownMenuItem key={id} onClick={() => setSelectedDeviceId(id)}>
                                  {selectedDeviceId === id ? (
                                    <Check className="mr-2 h-4 w-4 text-green-600" />
                                  ) : (
                                    <span className="mr-2 inline-block h-4 w-4" />
                                  )}
                                  <span
                                    className={
                                      selectedDeviceId === id ? 'font-medium text-green-700' : ''
                                    }
                                  >
                                    {id}
                                  </span>
                                </DropdownMenuItem>
                              ))
                            ) : (
                              <DropdownMenuItem disabled>No devices</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {selectedDeviceId ? `Device: ${selectedDeviceId}` : 'Select device'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-8 w-8 rounded-full"
                          onClick={() => buildLibs()}
                          aria-label="Build libs"
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Build Libs</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-8 w-8 rounded-full"
                          onClick={async () => {
                            await editorRef.current?.reloadTypings?.()
                            updateTypesStatus()
                          }}
                          aria-label="Refresh types"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Refresh Types</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <Dialog open={typesOpen} onOpenChange={setTypesOpen}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-8 w-8 rounded-full"
                            onClick={() => {
                              setTypesOpen(true) /* useEffect will update */
                            }}
                            aria-label="Show types"
                          >
                            <Braces className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Loaded Types</DialogTitle>
                          </DialogHeader>
                          <div className="max-h-[60vh] space-y-3 overflow-auto">
                            <div>
                              <div className="mb-1 text-sm font-medium">
                                Global typings ({typesGlobal.length})
                              </div>
                              <ul className="text-xs">
                                {typesGlobal.map((p) => (
                                  <li key={p} className="truncate">
                                    {p}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <div className="mb-1 text-sm font-medium">
                                Relative imports ({typesRelatives.length})
                              </div>
                              <ul className="text-xs">
                                {typesRelatives.map((p) => (
                                  <li key={p} className="truncate">
                                    <button
                                      type="button"
                                      className="text-left hover:underline"
                                      onClick={() => {
                                        try {
                                          setCurrentFile(p)
                                        } catch {}
                                        setTypesOpen(false)
                                      }}
                                    >
                                      {p}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Close</Button>
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <TooltipContent sideOffset={6}>Show Types</TooltipContent>
                    </Tooltip>
                  </div>
                  <div>
                    <AppiumToggleButton
                      queryKey={['appium-status', 'testcases']}
                      pollIntervalMs={appiumAutoRefresh ? 5000 : false}
                    />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`ml-1 h-8 w-8 rounded-full ${keepAppOpen ? 'text-green-600' : ''}`}
                          onClick={() => {
                            const v = !keepAppOpen
                            try {
                              localStorage.setItem('gtt:testcases:keepAppOpen', v ? '1' : '0')
                            } catch {}
                            setKeepAppOpen(v)
                          }}
                          aria-label="Keep App Open"
                        >
                          {keepAppOpen ? (
                            <Activity className="h-4 w-4 text-green-600" />
                          ) : (
                            <Activity className="h-4 w-4 text-yellow-600" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        Keep App Open {keepAppOpen ? '(On)' : '(Off)'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-8 w-8 rounded-full text-yellow-600 hover:text-yellow-700 focus-visible:ring-2 focus-visible:ring-red-500 active:text-red-800"
                          onClick={() => setConfirmCloseMineOpen(true)}
                          aria-label="Close current client sessions"
                        >
                          <Unplug className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Close current client sessions</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-8 w-8 rounded-full text-yellow-600 hover:text-yellow-700 focus-visible:ring-2 focus-visible:ring-red-500 active:text-red-800"
                          onClick={() => setConfirmCloseAllOpen(true)}
                          aria-label="Close all retained sessions"
                        >
                          <RouteOff className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Close all retained sessions</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full">
                          {connected ? (
                            <Server className="h-4 w-4 text-green-600" />
                          ) : (
                            <ServerOff className="h-4 w-4 text-red-600" />
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {connected ? 'Connected' : 'Disconnected'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Tooltip>
                    <Dialog>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-8 w-8 rounded-full"
                            aria-label="Settings"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Settings</TooltipContent>
                      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
                        <div className="flex h-[80vh] flex-col">
                          <div className="bg-background border-b p-6">
                            <DialogHeader>
                              <DialogTitle>Parameters</DialogTitle>
                            </DialogHeader>
                          </div>
                          <div className="flex-1 overflow-y-auto p-6">
                            <ParametersForm ref={paramsRef} hideActions />
                          </div>
                          <div className="bg-background border-t p-4">
                            <DialogFooter>
                              <Button onClick={() => paramsRef.current?.save()}>Save</Button>
                              <Button variant="outline" onClick={() => paramsRef.current?.reset()}>
                                Reset
                              </Button>
                              <DialogClose asChild>
                                <Button variant="outline">Close</Button>
                              </DialogClose>
                            </DialogFooter>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </Tooltip>
                </div>
              }
              onContentLoaded={({ content, original }, { filePath }) => {
                if (!filePath) return
                setFileCache((prev) => ({
                  ...prev,
                  [filePath]: { content, original },
                }))
                try {
                  localStorage.setItem(
                    `gtt:fileCache:testcases:${filePath}`,
                    JSON.stringify({ content, original })
                  )
                } catch {}
              }}
              onContentChange={(value, info) => {
                const fileKey = info?.filePath ?? currentFile
                if (!fileKey) return
                setFileCache((prev) => {
                  const existing = prev[fileKey]
                  const original = existing?.original ?? value
                  return {
                    ...prev,
                    [fileKey]: { content: value, original },
                  }
                })
                try {
                  localStorage.setItem(
                    `gtt:fileCache:testcases:${fileKey}`,
                    JSON.stringify({ content: value, original: value })
                  )
                } catch {}
              }}
              onContentSaved={({ content, original }, { filePath }) => {
                if (!filePath) return
                setFileCache((prev) => ({
                  ...prev,
                  [filePath]: { content, original },
                }))
                try {
                  localStorage.setItem(
                    `gtt:fileCache:testcases:${filePath}`,
                    JSON.stringify({ content, original })
                  )
                } catch {}
              }}
            />
          </div>
          {/* Controls moved into ScriptEditor header via extraActions */}
          <OutputPanel renderLogs={renderLogs} open={openLog} setOpen={setOpenLog} />
          {/* Danger confirmations */}
          <AlertDialog open={confirmCloseMineOpen} onOpenChange={setConfirmCloseMineOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close current client sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will close all retained Android sessions associated with this page. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    setConfirmCloseMineOpen(false)
                    closeKeptSessions()
                  }}
                >
                  Close
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={confirmCloseAllOpen} onOpenChange={setConfirmCloseAllOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close all retained sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will close all retained Android sessions across clients. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => {
                    setConfirmCloseAllOpen(false)
                    closeAllKeptSessions()
                  }}
                >
                  Close All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
