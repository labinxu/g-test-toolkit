'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Crosshair,
  Smartphone,
  RotateCcw,
  ImagePlay,
  RefreshCwOff,
  Server,
  ServerOff,
} from 'lucide-react'
import { AppiumToggleButton } from '@/components/appium-toggle-button'
import { SlidersHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ParametersForm, type ParametersFormHandle } from '@/components/settings/parameters-form'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import { ScriptEditor, type ScriptEditorHandle } from '@/components/files/script-editor'
import { PackagePlus } from 'lucide-react'
import { OutputPanel } from '@/components/output-panel'
import { useSocket } from '../socket-content'
import NewFileOrFolder from '@/components/files/new-file-folder'
import DirectoryTree from '../files/directory-tree'
import { toast } from 'sonner'
import AndroidInspectorEmbed from '@/components/android-inspector-embed'
import type {
  AndroidInspectorEmbedHandle,
  AndroidInspectorEmbedState,
} from '@/components/android-inspector-embed'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { MousePointer, Type, Braces, Timer, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLibsPageCache } from '../../page-cache'

export default function Page() {
  const libsCache = useLibsPageCache()
  const [currentFile, setCurrentFile] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('gtt:libs:lastFile') || ''
    } catch {
      return ''
    }
  })
  const [currentDir, setCurrentDir] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      const last = localStorage.getItem('gtt:libs:lastFile') || ''
      const i = last.lastIndexOf('/')
      return i > 0 ? last.slice(0, i) : ''
    } catch {
      return ''
    }
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const [openLog, setOpenLog] = useState(false)
  const [showAndroidInspector, setShowAndroidInspector] = useState(false)
  const [deviceIds, setDeviceIds] = useState<string[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [refreshKeyInspector, setRefreshKeyInspector] = useState(0)
  const [autoCenter, setAutoCenter] = useState(false)
  const [autoRefreshInspector, setAutoRefreshInspector] = useState(false)
  const [resetKeyInspector, setResetKeyInspector] = useState(0)
  const inspectorRef = useRef<AndroidInspectorEmbedHandle | null>(null)
  const editorRef = useRef<ScriptEditorHandle | null>(null)
  const paramsRef = useRef<ParametersFormHandle | null>(null)
  const [insertMode, setInsertMode] = useState<'click' | 'setValue' | 'selector' | 'longPress'>(
    () => {
      if (typeof window === 'undefined') return 'click'
      const v = localStorage.getItem('gtt:insertMode') as any
      return v === 'setValue' || v === 'selector' || v === 'longPress' || v === 'click'
        ? v
        : 'click'
    }
  )
  const [insertText, setInsertText] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('gtt:insertText') || ''
  })
  const [appiumAutoRefresh, setAppiumAutoRefresh] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:testcases-libs:appiumAutoRefresh')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [wrapColumn, setWrapColumn] = useState<number>(() => {
    if (typeof window === 'undefined') return 80
    try {
      const raw = localStorage.getItem('gtt:testcases-libs:editor:wrapColumn')
      const n = raw ? parseInt(raw, 10) : 80
      return Number.isFinite(n) ? n : 80
    } catch {
      return 80
    }
  })
  useEffect(() => {
    const handler = () => {
      try {
        const v = localStorage.getItem('gtt:testcases-libs:appiumAutoRefresh')
        setAppiumAutoRefresh(v == null ? true : v === '1' || v === 'true')
        const rc = localStorage.getItem('gtt:testcases-libs:editor:wrapColumn')
        const n = rc ? parseInt(rc, 10) : 80
        setWrapColumn(Number.isFinite(n) ? n : 80)
      } catch {}
    }
    window.addEventListener('storage', handler)
    window.addEventListener('gtt-parameters-updated', handler as any)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('gtt-parameters-updated', handler as any)
    }
  }, [])
  const [longPressMs, setLongPressMs] = useState<number>(() => {
    if (typeof window === 'undefined') return 800
    const raw = localStorage.getItem('gtt:longPressMs')
    const n = raw ? parseInt(raw, 10) : 800
    return Number.isFinite(n) ? n : 800
  })
  // Restore libs page cached UI state
  // Restore cached state on mount
  useEffect(() => {
    const s = useLibsPageCache.getState()
    if (s.hasCache) {
      setCurrentFile(s.currentFile)
      setCurrentDir(s.currentDir)
      setFileCache(s.fileCache)
      setOpenLog(s.openLog)
      setShowAndroidInspector(s.showAndroidInspector)
      setSelectedDeviceId(s.selectedDeviceId)
      setAutoCenter(s.autoCenter)
      setAutoRefreshInspector(s.autoRefreshInspector)
      setCachedInspectorState(s.cachedInspectorState)
    } else {
      // Fallback: restore last opened file from localStorage
      try {
        const last = localStorage.getItem('gtt:libs:lastFile')
        if (last) {
          setCurrentFile(last)
          const i = last.lastIndexOf('/')
          setCurrentDir(i > 0 ? last.slice(0, i) : '')
          // Bootstrap editor cache for instant show
          const raw = localStorage.getItem(`gtt:fileCache:libs:${last}`)
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

  useEffect(() => {
    try {
      localStorage.setItem('gtt:insertMode', insertMode)
    } catch {}
  }, [insertMode])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:insertText', insertText)
    } catch {}
  }, [insertText])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:longPressMs', String(longPressMs))
    } catch {}
  }, [longPressMs])
  const [cachedInspectorState, setCachedInspectorState] = useState<
    AndroidInspectorEmbedState | undefined
  >(undefined)
  const { logs, connected, clientId, clearLogs, running, setRunning } = useSocket()
  const [fileCache, setFileCache] = useState<Record<string, { content: string; original: string }>>(
    {}
  )

  // Keep latest state in a ref and save on unmount
  const lastRef = useRef<any>(null)
  useEffect(() => {
    lastRef.current = {
      currentFile,
      currentDir,
      fileCache,
      openLog,
      showAndroidInspector,
      selectedDeviceId,
      autoCenter,
      autoRefreshInspector,
      cachedInspectorState,
    }
  }, [
    currentFile,
    currentDir,
    fileCache,
    openLog,
    showAndroidInspector,
    selectedDeviceId,
    autoCenter,
    autoRefreshInspector,
    cachedInspectorState,
  ])
  useEffect(() => {
    return () => {
      const s = useLibsPageCache.getState()
      const st =
        inspectorRef.current?.exportState() ||
        s.cachedInspectorState ||
        lastRef.current?.cachedInspectorState
      libsCache.save({ ...(lastRef.current || {}), cachedInspectorState: st })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Persist last opened file for cross-page restore
  useEffect(() => {
    try {
      if (currentFile) localStorage.setItem('gtt:libs:lastFile', currentFile)
    } catch {}
  }, [currentFile])

  // Restore cached selected device ID on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('gtt:selectedDeviceId')
      if (cached) setSelectedDeviceId(cached)
    } catch {}
  }, [])

  // Persist selected device ID when it changes
  useEffect(() => {
    try {
      if (selectedDeviceId) {
        localStorage.setItem('gtt:selectedDeviceId', selectedDeviceId)
      } else {
        localStorage.removeItem('gtt:selectedDeviceId')
      }
    } catch {}
  }, [selectedDeviceId])

  const buildGettrLib = useCallback(async () => {
    fetch(`/api/testcase/gettrlib?clientId=${clientId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((resp) => {
        if (resp.ok) {
          toast.message('building...')
        }
      })
      .catch((err) => {
        toast.error(`${err}`)
      })
  }, [clientId])
  const buildCoreLib = useCallback(async () => {
    fetch(`/api/testcase/corelib?clientId=${clientId}`, {
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
  const runPath = useCallback(async () => {
    clearLogs()
    try {
      const csrfResp = await fetch(`/api/csrf-token`, {
        credentials: 'include',
      })
      const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null
      const csrfToken = csrf?.token
      await fetch(`/api/testcase/runpath`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ filePath: currentFile, clientId, shareSession: true, sessionKey: (selectedDeviceId || undefined) }),
      })
      toast.message('Start successful...')
      setOpenLog(true)
    } catch (err) {
      // ignore
    }
  }, [currentFile, clientId, clearLogs])
  // Poll Android device list when inspector panel is open
  useEffect(() => {
    if (!showAndroidInspector) return
    let stop = false
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
        if (ids.length) {
          setSelectedDeviceId((prev) => (ids.includes(prev) ? prev : ids[0]))
        } else {
          setSelectedDeviceId('')
        }
      } catch {}
    }
    fetchDevices()
    const id = window.setInterval(fetchDevices, 5000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [showAndroidInspector])

  // Auto refresh snapshot when enabled
  useEffect(() => {
    if (!showAndroidInspector || !autoRefreshInspector) return
    const id = window.setInterval(() => {
      setRefreshKeyInspector((k) => k + 1)
    }, 3000)
    return () => window.clearInterval(id)
  }, [showAndroidInspector, autoRefreshInspector])

  // Appium status handled by shared AppiumToggleButton
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
            api={'/api/testcase/listcore?depth=3'}
            currentDir={currentDir}
            refreshKey={refreshKey}
            setRefreshKey={setRefreshKey}
            onSelect={setCurrentFile}
            onDirSelect={setCurrentDir}
            selectedPath={currentFile}
            cacheEnabled={!dirCacheDisabled}
            cacheTtlMs={dirCacheTtlMs}
            collapsible={false}
          />
        </DirectoryTreePanel>
      </div>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col pl-1 transition-all duration-300">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-row items-stretch overflow-auto rounded-lg border">
            <ScriptEditor
              ref={editorRef}
              filePath={currentFile}
              wrapAtColumn={wrapColumn}
              cachedValue={currentFile ? fileCache[currentFile] : undefined}
              extraActions={
                <>
                  {/* Build libs */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={buildLibs}
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
                        className="h-8 w-8 rounded-full"
                        aria-label="Server status"
                      >
                        {connected ? (
                          <Server className="h-4 w-4 text-green-600" />
                        ) : (
                          <ServerOff className="h-4 w-4 text-red-600" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      sideOffset={6}
                    >{`${connected ? 'connected' : 'disconnect'}`}</TooltipContent>
                  </Tooltip>
                </>
              }
              onContentLoaded={({ content, original }, { filePath }) => {
                if (!filePath) return
                setFileCache((prev) => ({
                  ...prev,
                  [filePath]: { content, original },
                }))
                try {
                  localStorage.setItem(
                    `gtt:fileCache:libs:${filePath}`,
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
                    `gtt:fileCache:libs:${fileKey}`,
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
                    `gtt:fileCache:libs:${filePath}`,
                    JSON.stringify({ content, original })
                  )
                } catch {}
              }}
            />
            <div
              className={cn(
                'flex overflow-auto rounded-lg border p-2',
                showAndroidInspector ? 'min-w-[420px]' : ''
              )}
            >
              <div className="self-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 rounded-full border p-0 shadow"
                      onClick={() => {
                        if (showAndroidInspector) {
                          const st = inspectorRef.current?.exportState()
                          if (st) setCachedInspectorState(st)
                        }
                        setShowAndroidInspector((v) => !v)
                      }}
                      tabIndex={-1}
                      type="button"
                    >
                      {showAndroidInspector ? (
                        <ChevronRight size={18} />
                      ) : (
                        <ChevronLeft size={18} />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    {showAndroidInspector ? 'Collapse inspector' : 'Expand inspector'}
                  </TooltipContent>
                </Tooltip>
              </div>
              {showAndroidInspector ? (
                <div className="flex h-full flex-col items-stretch gap-2">
                  <div className="flex items-center gap-1">
                    {/* Reset viewport (zoom/pan) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => setResetKeyInspector((k) => k + 1)}
                          aria-label="Reset viewport"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Reset viewport</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => setRefreshKeyInspector((k) => k + 1)}
                          aria-label="Refresh snapshot"
                        >
                          <ImagePlay className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Refresh snapshot</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={autoRefreshInspector ? 'default' : 'ghost'}
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => setAutoRefreshInspector((v) => !v)}
                          aria-label="Toggle auto-refresh"
                        >
                          {!autoRefreshInspector ? (
                            <RefreshCwOff />
                          ) : (
                            <RefreshCw className={`h-4 w-4 animate-spin`} />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {autoRefreshInspector ? 'Auto-refresh: on' : 'Auto-refresh: off'}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={autoCenter ? 'default' : 'ghost'}
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => setAutoCenter((v) => !v)}
                          aria-label="Toggle auto-center"
                        >
                          <Crosshair className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {autoCenter ? 'Auto-center: on' : 'Auto-center: off'}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full relative"
                              aria-label="Select device"
                            >
                              <Smartphone className="h-4 w-4" />
                              {selectedDeviceId ? (
                                <span
                                  aria-hidden
                                  className="absolute -top-0.5 -right-0.5 inline-block h-2 w-2 rounded-full bg-green-500 ring-2 ring-background"
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
                                  <span className={selectedDeviceId === id ? 'text-green-700 font-medium' : ''}>{id}</span>
                                </DropdownMenuItem>
                              ))
                            ) : (
                              <DropdownMenuItem disabled>No device</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {selectedDeviceId ? `Device: ${selectedDeviceId}` : 'Select device'}
                      </TooltipContent>
                    </Tooltip>

                    {/* Appium power button */}
                    <AppiumToggleButton
                      queryKey={['appium-status', 'libs']}
                      pollIntervalMs={appiumAutoRefresh ? 5000 : false}
                    />
                    <Tooltip>
                      <Dialog>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
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
                                <Button
                                  variant="outline"
                                  onClick={() => paramsRef.current?.reset()}
                                >
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
                    {/* (Server status moved to ScriptEditor actions) */}
                  </div>
                  <AndroidInspectorEmbed
                    ref={inspectorRef}
                    deviceId={selectedDeviceId || undefined}
                    showToolbar={false}
                    showRefreshButton={false}
                    refreshKey={refreshKeyInspector}
                    resetKey={resetKeyInspector}
                    autoCenterOnClick={autoCenter}
                    onAutoCenterChange={setAutoCenter}
                    initialState={cachedInspectorState}
                    onSuggestSelector={(selector, meta) => {
                      const esc = (s: string) => (s ?? '').replace(/['\\]/g, (m) => `\\${m}`)
                      let snippet = ''
                      if (insertMode === 'click') {
                        if (meta?.isInput) {
                          const txt = insertText || 'your text'
                          snippet = [
                            `const el = await this.page.$('${selector}')`,
                            `await el.click()`,
                            `await el.setValue('${esc(txt)}')`,
                          ].join('\n')
                        } else {
                          snippet = `await this.page.$('${selector}').click()`
                        }
                      } else if (insertMode === 'setValue') {
                        const txt = insertText || 'your text'
                        snippet = [
                          `const el = await this.page.$('${selector}')`,
                          `await el.click()`,
                          `await el.setValue('${esc(txt)}')`,
                        ].join('\n')
                      } else if (insertMode === 'longPress') {
                        const ms = Math.max(200, Math.min(3000, longPressMs | 0))
                        snippet = `await (await this.page.$('${selector}')).touchAction({ action: 'longPress', duration: ${ms} })`
                      } else {
                        snippet = `'${selector}'`
                      }
                      editorRef.current?.insertAtCursor(snippet, {
                        ensureNewLine: true,
                      })
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
          {/* Controls moved into inspector toolbar; Control component removed */}
          <OutputPanel renderLogs={renderLogs} open={openLog} setOpen={setOpenLog} />
        </div>
      </div>
    </div>
  )
}
