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
  FileScan,
  ListRestart,
} from 'lucide-react'
import { AppiumToggleButton } from '@/components/appium-toggle-button'
import { SlidersHorizontal } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ParametersForm, type ParametersFormHandle } from '@/components/settings/parameters-form'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import MonacoScriptEditor, {
  type MonacoScriptEditorHandle,
} from '@/components/files/monaco-script-editor'
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
import { Check, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLibsPageCache } from '../../page-cache'
import { normalizeResponseError } from '@/lib/error'

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
  const [showClickableOnly, setShowClickableOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:inspector:clickableOnly')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [overlayMode, setOverlayMode] = useState<'boxes' | 'markers'>(() => {
    if (typeof window === 'undefined') return 'boxes'
    try {
      const v = localStorage.getItem('gtt:inspector:overlayMode')
      return v === 'markers' ? 'markers' : 'boxes'
    } catch {}
    return 'boxes'
  })
  const [preferAppiumLocal, setPreferAppiumLocal] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:inspector:preferAppiumSource')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })
  const [autoRefreshInspector, setAutoRefreshInspector] = useState(false)
  const [resetKeyInspector, setResetKeyInspector] = useState(0)
  const inspectorRef = useRef<AndroidInspectorEmbedHandle | null>(null)
  const editorRef = useRef<MonacoScriptEditorHandle | null>(null)
  const [typesOpen, setTypesOpen] = useState(false)
  const [typesGlobal, setTypesGlobal] = useState<string[]>([])
  const [typesRelatives, setTypesRelatives] = useState<string[]>([])
  const [reloadTypings, setReloadTypings] = useState(false)

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
        // AI defaults
        const rulesOnly = localStorage.getItem('gtt:ai:libs:useRulesOnly')
        setAiUseRulesOnly(rulesOnly === '1')
        const ml = localStorage.getItem('gtt:ai:libs:maxLines')
        const nl = ml ? parseInt(ml, 10) : 0
        setAiMaxLines(Number.isFinite(nl) ? (nl <= 0 ? 0 : Math.max(0, Math.min(200, nl))) : 0)
        const mc = localStorage.getItem('gtt:ai:libs:maxCol')
        const nc = mc ? parseInt(mc, 10) : 0
        setAiMaxCol(Number.isFinite(nc) ? (nc <= 0 ? 0 : Math.max(0, Math.min(400, nc))) : 0)
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

  // AI dialog state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiUseRulesOnly, setAiUseRulesOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return (localStorage.getItem('gtt:ai:libs:useRulesOnly') || '0') === '1'
    } catch {}
    return false
  })
  const [aiMaxLines, setAiMaxLines] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const raw = localStorage.getItem('gtt:ai:libs:maxLines')
      const n = raw ? parseInt(raw, 10) : 0
      if (!Number.isFinite(n)) return 0
      if (n <= 0) return 0
      return Math.max(0, Math.min(200, n))
    } catch {}
    return 0
  })
  const [aiMaxCol, setAiMaxCol] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const raw = localStorage.getItem('gtt:ai:libs:maxCol')
      const n = raw ? parseInt(raw, 10) : 0
      if (!Number.isFinite(n)) return 0
      if (n <= 0) return 0
      return Math.max(0, Math.min(400, n))
    } catch {}
    return 0
  })
  useEffect(() => {
    try {
      localStorage.setItem('gtt:ai:libs:useRulesOnly', aiUseRulesOnly ? '1' : '0')
    } catch {}
  }, [aiUseRulesOnly])
  useEffect(() => {
    try {
      if (aiMaxLines <= 0) localStorage.setItem('gtt:ai:libs:maxLines', '0')
      else
        localStorage.setItem(
          'gtt:ai:libs:maxLines',
          String(Math.max(0, Math.min(200, Math.floor(aiMaxLines))))
        )
    } catch {}
  }, [aiMaxLines])
  useEffect(() => {
    try {
      if (aiMaxCol <= 0) localStorage.setItem('gtt:ai:libs:maxCol', '0')
      else
        localStorage.setItem(
          'gtt:ai:libs:maxCol',
          String(Math.max(0, Math.min(400, Math.floor(aiMaxCol))))
        )
    } catch {}
  }, [aiMaxCol])

  const handleGenerateAi = useCallback(async () => {
    try {
      setAiLoading(true)
      const snap = inspectorRef.current?.exportState()?.data ?? null
      const payload: any = {
        prompt: aiPrompt || '',
        deviceId: selectedDeviceId || undefined,
        snapshot: snap || undefined,
        filePath: currentFile || undefined,
        cursor: editorRef.current?.getCursor?.() ?? undefined,
        focusNodeId: inspectorRef.current?.exportState()?.selectedId ?? undefined,
        useRulesOnly: aiUseRulesOnly ? 1 : 0,
        maxLines: aiMaxLines <= 0 ? 0 : Math.max(0, Math.min(200, Math.floor(aiMaxLines))),
      }
      const res = await fetch('/api/ai/libs-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          maxCol: aiMaxCol <= 0 ? 0 : Math.max(0, Math.min(400, Math.floor(aiMaxCol))),
        }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        throw new Error(err.message || 'Generation failed')
      }
      const data = await res.json()
      const snippet = (data?.snippet || '').toString().trim()
      if (!snippet) {
        throw new Error('LLM 返回为空')
      }
      editorRef.current?.insertAtCursor(snippet, { ensureNewLine: true })
      setAiOpen(false)
      setAiPrompt('')
      toast.success('已插入生成脚本')
    } catch (e: any) {
      toast.error(e?.message || 'AI 生成失败')
    } finally {
      setAiLoading(false)
    }
  }, [aiPrompt, selectedDeviceId, currentFile])
  const { logs, connected, clientId, building, setBuilding } = useSocket()
  // Auto refresh typings when server logs report lib build completion
  useEffect(() => {
    if (!building && reloadTypings) {
      console.log('reload typings', building, reloadTypings)
      setTimeout(() => editorRef.current?.reloadTypings?.({ force: true }), 200)
      setReloadTypings(false)
    }
  }, [building, reloadTypings])
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

  const buildLibs = useCallback(async () => {
    setBuilding(true)
    fetch(`/api/testcase/buildlibs?clientId=${clientId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((resp) => {
        if (resp.ok) {
          setReloadTypings(true)
          toast.message('Building...')
        }
      })
      .catch((err) => {
        setBuilding(false)
        setReloadTypings(false)
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
  // Sync clickable-only from Parameters changes
  useEffect(() => {
    const handler = () => {
      try {
        const v = localStorage.getItem('gtt:inspector:clickableOnly')
        setShowClickableOnly(v == null ? true : v === '1' || v === 'true')
        const m = localStorage.getItem('gtt:inspector:overlayMode')
        setOverlayMode(m === 'markers' ? 'markers' : 'boxes')
      } catch {}
    }
    window.addEventListener('storage', handler)
    window.addEventListener('gtt-parameters-updated', handler as any)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('gtt-parameters-updated', handler as any)
    }
  }, [])

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
            <div className="min-w-0 flex-1">
              <MonacoScriptEditor
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
                          disabled={building}
                        >
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Build Libs</TooltipContent>
                    </Tooltip>
                    {/* Refresh typings */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={async () => {
                            await editorRef.current?.reloadTypings?.({ force: true })
                            updateTypesStatus()
                          }}
                          aria-label="Refresh types"
                        >
                          <ListRestart className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>Refresh Types</TooltipContent>
                    </Tooltip>
                    {/* Types inspector */}
                    <Tooltip>
                      <Dialog open={typesOpen} onOpenChange={setTypesOpen}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            aria-label="Show loaded types"
                            type="button"
                            onClick={() => {
                              setTypesOpen(true) /* useEffect will update */
                            }}
                          >
                            <FileScan className="h-4 w-4" />
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
                    {/* AI generate */}
                    <Tooltip>
                      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            aria-label="AI 生成脚本片段"
                            type="button"
                            onClick={() => {
                              setAiOpen(true)
                              setAiPrompt('')
                            }}
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <DialogContent
                          className="max-w-2xl"
                          onEscapeKeyDown={(e) => e.preventDefault()}
                          onPointerDownOutside={(e) => e.preventDefault()}
                          onInteractOutside={(e) => e.preventDefault()}
                        >
                          <DialogHeader>
                            <DialogTitle>AI 生成脚本片段</DialogTitle>
                            <DialogDescription>
                              根据当前页面上下文生成可粘贴的脚本代码片段。
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex flex-col gap-2">
                            <label className="text-muted-foreground text-xs">
                              需求描述（例如：点击“登录”，或在“用户名”输入框输入“test_user”）
                            </label>
                            <Textarea
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              placeholder="描述你要在当前页面执行的操作"
                              className="min-h-24"
                            />
                            <div className="flex items-center gap-2">
                              <Button onClick={handleGenerateAi} disabled={aiLoading}>
                                {aiLoading ? '生成中…' : '生成'}
                              </Button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-4 rounded-md border p-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  id="ai-rules-only"
                                  checked={aiUseRulesOnly}
                                  onCheckedChange={(v) => setAiUseRulesOnly(!!v)}
                                />
                                <label
                                  htmlFor="ai-rules-only"
                                  className="cursor-pointer text-xs select-none"
                                >
                                  仅规则生成（禁用LLM）
                                </label>
                              </div>
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor="ai-max-lines"
                                  className="text-muted-foreground text-xs"
                                >
                                  最大行数
                                </label>
                                <Input
                                  id="ai-max-lines"
                                  type="number"
                                  min={0}
                                  max={200}
                                  className="h-8 w-20"
                                  value={aiMaxLines}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value || '0', 10)
                                    if (!Number.isFinite(n)) {
                                      setAiMaxLines(0)
                                    } else if (n <= 0) {
                                      setAiMaxLines(0)
                                    } else {
                                      setAiMaxLines(Math.max(0, Math.min(200, n)))
                                    }
                                  }}
                                />
                                <span className="text-muted-foreground text-xs">0 表示不限制</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor="ai-max-col"
                                  className="text-muted-foreground text-xs"
                                >
                                  最大列宽
                                </label>
                                <Input
                                  id="ai-max-col"
                                  type="number"
                                  min={0}
                                  max={400}
                                  className="h-8 w-24"
                                  value={aiMaxCol}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value || '0', 10)
                                    if (!Number.isFinite(n)) {
                                      setAiMaxCol(0)
                                    } else if (n <= 0) {
                                      setAiMaxCol(0)
                                    } else {
                                      setAiMaxCol(Math.max(0, Math.min(400, n)))
                                    }
                                  }}
                                />
                                <span className="text-muted-foreground text-xs">0 表示不限制</span>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <TooltipContent sideOffset={6}>AI 生成脚本</TooltipContent>
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
            </div>
            <div
              className={cn(
                'relative z-10 flex flex-none overflow-hidden rounded-lg border',
                showAndroidInspector ? 'p-2' : 'p-1'
              )}
              style={{
                width: showAndroidInspector ? 420 : 32,
                transition: 'width 240ms ease',
              }}
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
                      aria-expanded={showAndroidInspector}
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
                    {/* Appium XML toggle removed (moved to Parameters) */}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="relative h-8 w-8 rounded-full"
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
                                <DialogDescription>
                                  调整应用参数与 AI 设置，保存后将立即生效。
                                </DialogDescription>
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
                    showClickableOnly={showClickableOnly}
                    overlayMode={overlayMode}
                    preferAppium={preferAppiumLocal}
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
