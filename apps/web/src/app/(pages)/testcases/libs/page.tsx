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
  Power,
} from 'lucide-react'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import { ScriptEditor } from '@/components/files/script-editor'
import { Control } from '../control'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export default function Page() {
  const [currentFile, setCurrentFile] = useState('')
  const [currentDir, setCurrentDir] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [openLog, setOpenLog] = useState(false)
  const [showAndroidInspector, setShowAndroidInspector] = useState(false)
  const [deviceIds, setDeviceIds] = useState<string[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [refreshKeyInspector, setRefreshKeyInspector] = useState(0)
  const [autoCenter, setAutoCenter] = useState(true)
  const [autoRefreshInspector, setAutoRefreshInspector] = useState(false)
  const [resetKeyInspector, setResetKeyInspector] = useState(0)
  const [appiumRunning, setAppiumRunning] = useState<boolean>(false)
  const [appiumBusy, setAppiumBusy] = useState(false)
  const inspectorRef = useRef<AndroidInspectorEmbedHandle | null>(null)
  const [cachedInspectorState, setCachedInspectorState] = useState<
    AndroidInspectorEmbedState | undefined
  >(undefined)
  const { logs, connected, clientId, clearLogs, running, setRunning } = useSocket()
  const [fileCache, setFileCache] = useState<
    Record<
      string,
      {
        content: string
        original: string
      }
    >
  >({})

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

  // Poll Appium status when panel is open
  useEffect(() => {
    if (!showAndroidInspector) return
    let cancelled = false
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/android/appium/status', {
          method: 'GET',
        })
        if (!res.ok) return
        const j = (await res.json()) as { running?: boolean; port?: number }
        if (!cancelled) setAppiumRunning(!!j?.running)
      } catch {}
    }
    fetchStatus()
    const t = window.setInterval(fetchStatus, 5000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [showAndroidInspector])

  const toggleAppium = async () => {
    if (appiumBusy) return
    setAppiumBusy(true)
    try {
      if (appiumRunning) {
        const res = await fetch('/api/android/appium/stop', { method: 'POST' })
        if (!res.ok) throw new Error(await res.text())
        const j = await res.json().catch(() => ({}) as any)
        setAppiumRunning(false)
        toast.success(j?.stopped ? 'Appium stopped' : 'Appium not running')
      } else {
        const res = await fetch('/api/android/appium/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!res.ok) throw new Error(await res.text())
        const j = await res.json().catch(() => ({}) as any)
        setAppiumRunning(true)
        toast.success(j?.port ? `Appium server started on ${j.port}` : 'Appium started')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to toggle Appium')
    } finally {
      setAppiumBusy(false)
    }
  }
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
            collapsible={false}
          />
        </DirectoryTreePanel>
      </div>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col pl-1 transition-all duration-300">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-row items-stretch rounded-lg border">
            <ScriptEditor
              filePath={currentFile}
              cachedValue={currentFile ? fileCache[currentFile] : undefined}
              onContentLoaded={({ content, original }, { filePath }) => {
                if (!filePath) return
                setFileCache((prev) => ({
                  ...prev,
                  [filePath]: { content, original },
                }))
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
              }}
              onContentSaved={({ content, original }, { filePath }) => {
                if (!filePath) return
                setFileCache((prev) => ({
                  ...prev,
                  [filePath]: { content, original },
                }))
              }}
            />
            <div className="flex rounded-lg border p-2">
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
                          <RefreshCw className="h-4 w-4" />
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
                          <RefreshCw
                            className={`h-4 w-4 ${autoRefreshInspector ? 'animate-spin' : ''}`}
                          />
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
                              className="h-8 w-8 rounded-full"
                              aria-label="Select device"
                            >
                              <Smartphone className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            {deviceIds.length ? (
                              deviceIds.map((id) => (
                                <DropdownMenuItem key={id} onClick={() => setSelectedDeviceId(id)}>
                                  {id}
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={toggleAppium}
                          disabled={appiumBusy}
                          aria-label={appiumRunning ? 'Stop Appium' : 'Start Appium'}
                        >
                          <Power
                            className={`h-4 w-4 ${appiumRunning ? 'text-green-600' : 'text-red-600'}`}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        {appiumBusy
                          ? 'Handling'
                          : appiumRunning
                            ? 'Appium running. Click to stop'
                            : 'Start Appium'}
                      </TooltipContent>
                    </Tooltip>
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
                  />
                </div>
              ) : null}
            </div>
          </div>
          <Control
            currentFile={currentFile}
            running={running}
            connected={connected}
            setRunning={setRunning}
            buildLibs={buildLibs}
          />
          <OutputPanel renderLogs={renderLogs} open={openLog} setOpen={setOpenLog} />
        </div>
      </div>
    </div>
  )
}
