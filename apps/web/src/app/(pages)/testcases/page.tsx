'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import MonacoScriptEditor, {
  type MonacoScriptEditorHandle,
  preloadMonacoEditorAssets,
} from '@/components/files/monaco-script-editor'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  RefreshCw,
  Play,
  PackagePlus,
  SlidersHorizontal,
  Activity,
  RouteOff,
  Unplug,
  Server,
  ServerOff,
  Smartphone,
  Check,
  FileScan,
  ListRestart,
  Square,
  Trash2,
  Pencil,
} from 'lucide-react'
import { AppiumToggleButton } from '@/components/appium-toggle-button'
// removed Switch in favor of icon toggle for Keep App Open
import { OutputPanel } from '@/components/output-panel'
import { useSocket } from './socket-content'
import NewFileOrFolder from '@/components/files/new-file-folder'
import DirectoryTree, { type FileNode, type DirectoryTreeAction } from '@/components/files/directory-tree'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { OptionsSelect } from '@/components/select/options-select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { DeleteAlertDialog } from './alert-dialog/delete-alert'
import { RunAlertDialog } from './alert-dialog/run-alert'
import { ParametersForm, type ParametersFormHandle } from '@/components/settings/parameters-form'
import { useTestcasesPageCache } from '../page-cache'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'

export default function Page() {
  const router = useRouter()
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
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null)
  const [runTarget, setRunTarget] = useState<FileNode | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
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
  useEffect(() => {
    preloadMonacoEditorAssets().catch(() => {})
  }, [])
  const [openLog, setOpenLog] = useState(false)
  const { logs, connected, clientId, clearLogs, running, setRunning } = useSocket()
  const [fileCache, setFileCache] = useState<Record<string, { content: string; original: string }>>(
    {}
  )
  const [envRunDialogOpen, setEnvRunDialogOpen] = useState(false)
  const [envRunDialogLoading, setEnvRunDialogLoading] = useState(false)
  const [envRunTemplates, setEnvRunTemplates] = useState<
    {
      id: number
      platform: string
      driver: 'browser' | 'android' | 'ios' | 'other'
      key: string
      name: string
      description?: string | null
      config?: any
    }[]
  >([])
  const [envRunSelectedId, setEnvRunSelectedId] = useState<number | 'none' | null>('none')
  const [envRunPlatform, setEnvRunPlatform] = useState<string>('gettr-web')
  const [envRunDriver, setEnvRunDriver] = useState<'browser' | 'android' | 'ios' | 'other'>(
    'browser'
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
  const [dirFilterText, setDirFilterText] = useState('')
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
  const [linkedScenario, setLinkedScenario] = useState<{
    id: number
    code: string
    title: string
    platform: string
  } | null>(null)
  const [linkingScenario, setLinkingScenario] = useState(false)
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
          setTimeout(() => editorRef.current?.reloadTypings?.({ force: true }), 200)
        } catch {}
        lastTypingsReloadIdxRef.current = L
        // 构建完成后重新允许点击 Build Libs
        setBuildingLibs(false)
        break
      }
    }
  }, [logs])
  const getEnvRunStorageKey = (platform: string, driver: string) =>
    `gtt:testcases:envTemplate:${platform || 'default'}:${driver || 'browser'}`

  const inferPlatformAndDriverFromPath = (filePath: string): {
    platform: string
    driver: 'browser' | 'android' | 'ios' | 'other'
  } => {
    const parts = (filePath || '').split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'cases')
    const platform = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : 'gettr-web'
    const driver: 'browser' | 'android' | 'ios' | 'other' =
      platform === 'gettr-android'
        ? 'android'
        : platform.includes('-api-')
        ? 'other'
        : 'browser'
    return { platform, driver }
  }

  const openRunEnvDialog = useCallback(async () => {
    if (!currentFile) {
      toast.error('请先在左侧选择一个用例文件')
      return
    }
    const { platform, driver } = inferPlatformAndDriverFromPath(currentFile)
    setEnvRunPlatform(platform)
    setEnvRunDriver(driver)
    setEnvRunDialogOpen(true)
    setEnvRunDialogLoading(true)
    setEnvRunSelectedId('none')
    try {
      const qs = new URLSearchParams()
      qs.set('platform', platform)
      qs.set('driver', driver)
      const res = await fetch(`/api/env-templates?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '加载环境模板失败')
      }
      const data = await res.json()
      const list: any[] = Array.isArray(data?.items) ? data.items : []
      const mapped = list.map((it) => {
        let cfg: any = {}
        try {
          cfg =
            it.config && typeof it.config === 'string'
              ? JSON.parse(it.config)
              : it.config || {}
        } catch {
          cfg = {}
        }
        return {
          id: Number(it.id),
          platform: String(it.platform || platform),
          driver: (it.driver || driver) as 'browser' | 'android' | 'ios' | 'other',
          key: String(it.key || ''),
          name: String(it.name || it.key || ''),
          description: (it.description as string | null | undefined) ?? null,
          config: cfg,
        }
      })
      setEnvRunTemplates(mapped)
      if (mapped.length === 1) {
        setEnvRunSelectedId(mapped[0]!.id)
      } else if (mapped.length > 1) {
        try {
          const raw = localStorage.getItem(getEnvRunStorageKey(platform, driver))
          if (raw) {
            const lastId = Number(raw)
            if (Number.isFinite(lastId) && mapped.some((tpl) => tpl.id === lastId)) {
              setEnvRunSelectedId(lastId)
            }
          }
        } catch {}
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '加载环境模板失败')
      }
      setEnvRunTemplates([])
    } finally {
      setEnvRunDialogLoading(false)
    }
  }, [currentFile])
  const runPath = useCallback(
    async (envConfig?: any, filePathOverride?: string) => {
      const filePath = filePathOverride || currentFile
      if (!filePath) {
        toast.error('请选择用例文件')
        return
      }
      clearLogs()
      const csrfResp = await fetch(`/api/csrf-token`, { credentials: 'include' })
      const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null
      const csrfToken = csrf?.token

      fetch(`/api/testcase/runpath`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          filePath,
          clientId,
          keepAppOpen,
          shareSession: true,
          sessionKey: selectedDeviceId || undefined,
          envConfig,
        }),
      })
        .then((resp) => {
          if (resp.ok) {
            toast.message('Start succefull...')
            setRunning(true)
          }
        })
        .catch(() => {
          setRunning(false)
        })
      setOpenLog(true)
    },
    [currentFile, clientId, keepAppOpen, selectedDeviceId, clearLogs]
  )

  const getParentDir = useCallback((path: string) => {
    const idx = path.lastIndexOf('/')
    return idx > 0 ? path.slice(0, idx) : ''
  }, [])

  const handleDeleteNode = useCallback(
    async (node: FileNode) => {
      setDeleteLoading(true)
      try {
        const res = await fetch('/api/files/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: node.path }),
        })
        if (!res.ok) {
          const err = await normalizeResponseError(res)
          throw new Error(err.message || 'Delete failed')
        }
        setRefreshKey((k) => k + 1)
        if (currentFile === node.path) {
          setCurrentFile('')
        }
        if (node.isDirectory) {
          setCurrentDir((dir) => {
            const parent = getParentDir(node.path)
            return dir === node.path ? parent : dir
          })
        }
        toast.success('Delete succeeded')
      } catch (e: any) {
        const msg = e?.message || 'Delete failed'
        toast.error(msg)
      } finally {
        setDeleteLoading(false)
        setDeleteTarget(null)
      }
    },
    [currentFile, getParentDir]
  )

  const handleRenameNode = useCallback(
    async (node: FileNode) => {
      try {
        const currentName = node.name || node.path.split('/').pop() || ''
        const input = window.prompt('Rename to', currentName)
        if (input == null) return
        const newName = input.trim()
        if (!newName || newName === currentName) return
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: node.path, newName }),
        })
        if (!res.ok) {
          const err = await normalizeResponseError(res)
          throw new Error(err.message || 'Rename failed')
        }
        const data = await res.json().catch(() => ({} as any))
        const newPath: string = data?.newPath || `${getParentDir(node.path)}/${newName}`
        setRefreshKey((k) => k + 1)
        setCurrentFile((prev) => (prev === node.path ? newPath : prev))
        setCurrentDir((prev) => (prev === node.path ? newPath : prev))
        toast.success('Rename succeeded')
      } catch (e: any) {
        const msg = e?.message || 'Rename failed'
        toast.error(msg)
      }
    },
    [getParentDir]
  )

  const handleRunConfirm = useCallback(
    async (node: FileNode) => {
      if (!node?.path) return
      setCurrentFile(node.path)
      await runPath(undefined, node.path)
      setRunTarget(null)
    },
    [runPath]
  )

  const nodeActions = useCallback(
    (node: FileNode): DirectoryTreeAction[] => [
      {
        key: 'rename',
        label: 'Rename',
        icon: Pencil,
        onSelect: () => handleRenameNode(node),
      },
      {
        key: 'run',
        label: 'Run',
        icon: Play,
        disabled: node.isDirectory,
        onSelect: () => setRunTarget(node),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        danger: true,
        onSelect: () => setDeleteTarget(node),
      },
    ],
    [handleRenameNode]
  )

  // Resolve current testcase file back to UserScenario (if generated from scenarios)
  useEffect(() => {
    if (!currentFile || !currentFile.startsWith('workspace/users/')) {
      setLinkedScenario(null)
      return
    }
    let cancelled = false
    const run = async () => {
      try {
        setLinkingScenario(true)
        const qs = new URLSearchParams({ path: currentFile })
        const res = await fetch(`/api/user-scenarios/resolve-testcase?${qs.toString()}`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setLinkedScenario(null)
          return
        }
        const data = await res.json()
        const scenario = (data && data.scenario) || null
        if (cancelled) return
        if (!scenario) {
          setLinkedScenario(null)
        } else {
          setLinkedScenario({
            id: scenario.id,
            code: scenario.code,
            title: scenario.title,
            platform: scenario.platform,
          })
        }
      } catch {
        if (!cancelled) setLinkedScenario(null)
      } finally {
        if (!cancelled) setLinkingScenario(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [currentFile])

  const stopRun = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('确认要停止当前用例吗？')
      if (!confirmed) {
        return
      }
    }
    try {
      const csrfResp = await fetch(`/api/csrf-token`, {
        credentials: 'include',
      })
      const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null
      const csrfToken = csrf?.token
      const res = await fetch('/api/testcase/stop', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          clientId,
          sessionKey: selectedDeviceId || undefined,
        }),
      })
      if (!res.ok) {
        const err = await (async () => {
          try {
            const mod = await import('@/lib/error')
            return mod.normalizeResponseError(res)
          } catch {
            return { message: res.statusText }
          }
        })()
        toast.error(err.message || 'Stop failed')
      } else {
        toast.message('Stop requested')
        setRunning(false)
      }
    } catch (e: any) {
      toast.error(e?.message || 'Stop failed')
    }
  }, [clientId, selectedDeviceId])
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
  const [buildingLibs, setBuildingLibs] = useState(false)
  const buildLibs = useCallback(async () => {
    if (buildingLibs) return
    setBuildingLibs(true)
    try {
      const resp = await fetch(`/api/testcase/buildlibs?clientId=${clientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (resp.ok) {
        toast.message('Building libs...')
      } else {
        const text = await resp.text()
        toast.error(text || 'Build libs request failed')
      }
    } catch (err: any) {
      toast.error(String(err))
    }
  }, [buildingLibs, clientId])

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
  // Restore cached state on mount, with support for "forceReload" (from Scenarios page)
  useEffect(() => {
    let lastFromStorage = ''
    let forceReload = false
    try {
      lastFromStorage = localStorage.getItem('gtt:testcases:lastFile') || ''
      forceReload = localStorage.getItem('gtt:testcases:forceReload') === '1'
    } catch {}
    const s = useTestcasesPageCache.getState()
    if (s.hasCache && !forceReload) {
      setCurrentFile(s.currentFile)
      setCurrentDir(s.currentDir)
      setFileCache(s.fileCache)
      setOpenLog(s.openLog)
    } else if (lastFromStorage) {
      const last = lastFromStorage
      setCurrentFile(last)
      const i = last.lastIndexOf('/')
      setCurrentDir(i > 0 ? last.slice(0, i) : '')
      if (!forceReload) {
        // Bootstrap editor cache for instant show（仅在不强制刷新的情况下）
        try {
          const raw = localStorage.getItem(`gtt:fileCache:testcases:${last}`)
          if (raw) {
            const obj = JSON.parse(raw) as {
              content: string
              original: string
            }
            setFileCache((prev) => ({ ...prev, [last]: obj }))
          }
        } catch {}
      } else {
        // 强制刷新：清除该文件的本地缓存（内存 + localStorage + 全局缓存），确保从服务器重新加载
        try {
          localStorage.removeItem(`gtt:fileCache:testcases:${last}`)
          localStorage.removeItem('gtt:testcases:forceReload')
        } catch {}
        setFileCache((prev) => {
          const next = { ...prev }
          delete next[last]
          return next
        })
        try {
          const g = globalThis as any
          const cache: Map<string, { content: string; original: string }> | undefined =
            g.__gttFileContentCache
          cache?.delete(last)
        } catch {}
      }
    }
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
              filterText={dirFilterText}
              onFilterChange={setDirFilterText}
            />
            <DirectoryTree
              api="/api/testcase/listcases?&depth=3"
              currentDir={currentDir}
              refreshKey={refreshKey}
              onSelect={setCurrentFile}
              onDirSelect={setCurrentDir}
              selectedPath={currentFile}
              cacheEnabled={!dirCacheDisabled}
              cacheTtlMs={dirCacheTtlMs}
              collapsible={false}
              filterText={dirFilterText}
              nodeActions={nodeActions}
            />
          </DirectoryTreePanel>
        </div>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col pl-4 transition-all duration-300">
        {currentFile && linkedScenario && (
          <div className="mb-1 flex items-center justify-between rounded-md border bg-muted/40 px-2 py-1 text-[11px]">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">
                映射用例：[{linkedScenario.platform}] {linkedScenario.code}（ID:{' '}
                {linkedScenario.id}）
              </span>
              <span className="text-muted-foreground truncate">
                {linkedScenario.title}
              </span>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="ml-2 h-6 px-2 text-[11px]"
              onClick={() => {
                try {
                  localStorage.setItem('gtt:scenarios:lastCaseId', String(linkedScenario.id))
                } catch {}
                router.push('/scenarios')
              }}
            >
              在「用户场景」中查看
            </Button>
          </div>
        )}
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
                          variant={running ? 'destructive' : 'ghost'}
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => (running ? stopRun() : openRunEnvDialog())}
                          disabled={!currentFile}
                          aria-label={running ? 'Stop' : 'Execute'}
                        >
                          {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>{running ? 'Stop' : 'Execute'}</TooltipContent>
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
                          disabled={buildingLibs}
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
                            await editorRef.current?.reloadTypings?.({
                              force: true,
                            })
                            updateTypesStatus()
                          }}
                          aria-label="Refresh types"
                        >
                          <ListRestart className="h-4 w-4" />
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
      {/* 运行用例时选择环境模板 */}
      <Dialog open={envRunDialogOpen} onOpenChange={setEnvRunDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(e) => {
            if (envRunDialogLoading) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (envRunDialogLoading) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (envRunDialogLoading) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>选择运行环境模板</DialogTitle>
            <DialogDescription>
              为当前用例选择一套 useTestCase 环境配置。不同用户可选择不同模板，但复用同一套用例代码。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              当前平台：{envRunPlatform} · 驱动：
              {envRunDriver === 'android'
                ? 'Android'
                : envRunDriver === 'browser'
                ? 'Browser'
                : envRunDriver}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">环境模板</Label>
              <OptionsSelect<string>
                value={
                  envRunSelectedId == null
                    ? 'none'
                    : envRunSelectedId === 'none'
                    ? 'none'
                    : String(envRunSelectedId)
                }
                items={[
                  {
                    value: 'none',
                    label: '不使用模板（使用代码中的默认配置）',
                  },
                  ...envRunTemplates.map((tpl) => ({
                    value: String(tpl.id),
                    label: `${tpl.name} (${tpl.key})`,
                  })),
                ]}
                onSelect={(item) => {
                  if (item.value === 'none') {
                    setEnvRunSelectedId('none')
                  } else {
                    const n = Number(item.value)
                    setEnvRunSelectedId(Number.isFinite(n) ? n : null)
                  }
                }}
                disabled={envRunDialogLoading}
                triggerClassName="text-xs"
              />
              {envRunTemplates.length === 0 && !envRunDialogLoading && (
                <p className="text-[11px] text-muted-foreground">
                  当前平台尚未配置环境模板，将按用例代码中的默认 useTestCase 配置运行。
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={envRunDialogLoading}
              onClick={() => {
                if (envRunDialogLoading) return
                setEnvRunDialogOpen(false)
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={envRunDialogLoading || !currentFile}
              onClick={async () => {
                if (!currentFile) return
                const tplId =
                  envRunSelectedId && envRunSelectedId !== 'none'
                    ? Number(envRunSelectedId)
                    : null
                let envConfig: any = undefined
                if (tplId != null) {
                  const tpl = envRunTemplates.find((t) => t.id === tplId)
                  if (tpl && tpl.config && typeof tpl.config === 'object') {
                    envConfig =
                      envRunDriver === 'android'
                        ? { android: tpl.config }
                        : { browser: tpl.config }
                    try {
                      localStorage.setItem(
                        getEnvRunStorageKey(envRunPlatform, envRunDriver),
                        String(tplId)
                      )
                    } catch {}
                  }
                }
                setEnvRunDialogLoading(true)
                try {
                  await runPath(envConfig)
                  setEnvRunDialogOpen(false)
                } finally {
                  setEnvRunDialogLoading(false)
                }
              }}
            >
              执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteAlertDialog
        deleting={deleteLoading}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        handleDelete={handleDeleteNode}
      />
      <RunAlertDialog
        running={running}
        runTarget={runTarget}
        setRunTarget={setRunTarget}
        handleRun={handleRunConfirm}
      />
    </div>
  )
}
