'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Play,
  Square,
  Search,
  Trash2,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Aperture,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { GTable } from './components/g-table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const defaultHeaders = { Accept: 'application/json' }
const jsonHeaders = { ...defaultHeaders, 'Content-Type': 'application/json' }

const normalizeAvdKey = (value: string | null | undefined) =>
  value?.replace(/[\s_-]/g, '').toLowerCase() ?? ''

const avdKeysMatch = (source: string | null | undefined, target: string | null | undefined) => {
  const sourceKey = normalizeAvdKey(source)
  const targetKey = normalizeAvdKey(target)
  if (!sourceKey || !targetKey) return false
  return sourceKey === targetKey || sourceKey.includes(targetKey) || targetKey.includes(sourceKey)
}

type AndroidEmulatorResponse = {
  avds: string[]
  running: {
    serial: string
    avd: string | null
    deviceName: string | null
  } | null
}

type AndroidStopResponse = {
  result: string
  stopped: boolean
  serial?: string
  avd?: string | null
  deviceName?: string | null
  message?: string
}

type AndroidStartResponse = {
  result: string
  started?: boolean
  serial: string
  avd: string | null
  deviceName?: string | null
  message?: string
  randomizedDeviceId?: string | null
  deviceId?: string | null
}

type AndroidDeleteResponse = {
  result: string
  deleted: boolean
  avd: string
  message?: string
}

type AndroidCreatableTemplate = {
  id: string
  label: string
  description?: string
  defaultName: string
}

type AndroidCreatableResponse = {
  templates: AndroidCreatableTemplate[]
}

type AndroidCreateResponse = {
  result: string
  created: boolean
  avd: string
  templateId: string
  message?: string
}

type IosSimulator = {
  name: string
  udid: string
  runtime: string
  state: string
  isAvailable: boolean
  platformVersion?: string
  capabilities?: Record<string, any>
}

type IosListResponse = {
  result: string
  devices: IosSimulator[]
}

type IosActionResponse = {
  result: string
  started?: boolean
  stopped?: boolean
  simulator: IosSimulator | null
  message?: string
}

export default function Page() {
  const [devices, setDevices] = useState<string>('')
  const [deviceList, setDeviceList] = useState<string[][]>([])
  const [selectedDeviceId, setSelectDeviceId] = useState<string>('')
  const [actionAvd, setActionAvd] = useState<string | null>(null)
  const [iosActionUdid, setIosActionUdid] = useState<string | null>(null)
  const [pendingStopAvd, setPendingStopAvd] = useState<string | null>(null)
  const [deletingAvd, setDeletingAvd] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [customAvdName, setCustomAvdName] = useState<string>('')
  const [resetSelections, setResetSelections] = useState<Record<string, boolean>>({})
  const [deviceIds, setDeviceIds] = useState<Record<string, string>>({})
  const [androidHeadless, setAndroidHeadless] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:androidSimulators:headless')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })
  // Android Simulators auto-refresh controls
  const [androidSimsAutoRefresh, setAndroidSimsAutoRefresh] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:androidSimulators:autoRefresh')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [androidSimsRefreshSec, setAndroidSimsRefreshSec] = useState<number>(() => {
    if (typeof window === 'undefined') return 3
    try {
      const v = parseInt(localStorage.getItem('gtt:androidSimulators:refreshSec') || '3', 10)
      return Number.isFinite(v) && v >= 1 ? v : 3
    } catch {}
    return 3
  })
  // Android Devices auto-refresh controls
  const [androidAutoRefresh, setAndroidAutoRefresh] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:androidDevices:autoRefresh')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [androidRefreshSec, setAndroidRefreshSec] = useState<number>(() => {
    if (typeof window === 'undefined') return 3
    try {
      const v = parseInt(localStorage.getItem('gtt:androidDevices:refreshSec') || '3', 10)
      return Number.isFinite(v) && v >= 1 ? v : 3
    } catch {}
    return 3
  })
  // Section collapse states
  const [androidDevicesCollapsed, setAndroidDevicesCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:section:androidDevicesCollapsed')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })
  const [androidSimulatorsCollapsed, setAndroidSimulatorsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:section:androidSimulatorsCollapsed')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })
  const [iosSimulatorsCollapsed, setIosSimulatorsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:section:iosSimulatorsCollapsed')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gtt:androidSimulators:headless', androidHeadless ? '1' : '0')
    } catch {}
  }, [androidHeadless])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:androidSimulators:autoRefresh', androidSimsAutoRefresh ? '1' : '0')
    } catch {}
  }, [androidSimsAutoRefresh])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:androidSimulators:refreshSec', String(androidSimsRefreshSec | 0))
    } catch {}
  }, [androidSimsRefreshSec])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:androidDevices:autoRefresh', androidAutoRefresh ? '1' : '0')
    } catch {}
  }, [androidAutoRefresh])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:androidDevices:refreshSec', String(androidRefreshSec | 0))
    } catch {}
  }, [androidRefreshSec])
  useEffect(() => {
    try {
      localStorage.setItem(
        'gtt:section:androidDevicesCollapsed',
        androidDevicesCollapsed ? '1' : '0'
      )
    } catch {}
  }, [androidDevicesCollapsed])
  useEffect(() => {
    try {
      localStorage.setItem(
        'gtt:section:androidSimulatorsCollapsed',
        androidSimulatorsCollapsed ? '1' : '0'
      )
    } catch {}
  }, [androidSimulatorsCollapsed])
  useEffect(() => {
    try {
      localStorage.setItem('gtt:section:iosSimulatorsCollapsed', iosSimulatorsCollapsed ? '1' : '0')
    } catch {}
  }, [iosSimulatorsCollapsed])
  const queryClient = useQueryClient()
  const router = useRouter()

  // Restore cached selected device ID on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('gtt:selectedDeviceId')
      if (cached) setSelectDeviceId(cached)
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

  // Appium server status
  type AppiumStatus = { running: boolean; port?: number }
  const appiumStatusQuery = useQuery<AppiumStatus>({
    queryKey: ['appium-status'],
    queryFn: async () => {
      const res = await fetch('/api/android/appium/status', {
        method: 'GET',
        headers: defaultHeaders,
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to fetch appium status')
      }
      return res.json()
    },
    staleTime: 5000,
    refetchOnWindowFocus: false,
  })

  const startAppiumMutation = useMutation<
    { result: string; started?: boolean; port?: number },
    Error,
    { port?: number }
  >({
    mutationFn: async ({ port }) => {
      const res = await fetch('/api/android/appium/start', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ port }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to start appium')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.port ? `Appium server started on ${data.port}` : 'Appium server started')
      queryClient.invalidateQueries({ queryKey: ['appium-status'] })
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to start appium'),
  })

  const stopAppiumMutation = useMutation<{ result: string; stopped?: boolean }, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/android/appium/stop', {
        method: 'POST',
        headers: defaultHeaders,
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to stop appium')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.stopped ? 'Appium server stopped' : 'Appium not running')
      queryClient.invalidateQueries({ queryKey: ['appium-status'] })
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to stop appium'),
  })

  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () =>
      fetch(`/api/android/devices`, {
        method: 'GET',
        headers: defaultHeaders,
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch devices')
        }
        return res.json()
      }),
    staleTime: 5000,
    refetchOnWindowFocus: false,
    enabled: !androidDevicesCollapsed,
    refetchInterval:
      !androidDevicesCollapsed && androidAutoRefresh
        ? Math.max(1000, (androidRefreshSec || 1) * 1000)
        : false,
    refetchIntervalInBackground: !androidDevicesCollapsed && androidAutoRefresh,
  })

  useEffect(() => {
    if (devicesQuery.data?.devices) {
      setDevices(devicesQuery.data.devices)
    }
  }, [devicesQuery.data?.devices])

  useEffect(() => {
    if (!devices) return
    const dlist = devices
      .split('\n')
      .map((line: string) => line.trim())
      .filter((v: string) => v !== '')
      // Only keep lines that indicate a connected device
      .filter((v: string) => v.endsWith('device'))
      // Exclude Android emulators; we only want USB phones here
      .filter((v: string) => !v.startsWith('emulator-'))
    // Split by any whitespace to be robust across adb versions
    const rows = dlist.map((line: string) => line.split(/\s+/))
    // Append availability marker for status indicator in GTable
    rows.forEach((row) => row.push('Free'))
    setDeviceList(rows)
  }, [devices])

  const onSelectedRow = useCallback((data: string[]) => {
    setSelectDeviceId(data[0])
  }, [])

  const emulatorQuery = useQuery<AndroidEmulatorResponse>({
    queryKey: ['android-emulators'],
    queryFn: async () => {
      const res = await fetch('/api/android/emulators', {
        method: 'GET',
        headers: defaultHeaders,
      })
      if (!res.ok) {
        throw new Error('Failed to fetch emulators')
      }
      return res.json()
    },
    enabled: !androidSimulatorsCollapsed,
    refetchInterval:
      !androidSimulatorsCollapsed && androidSimsAutoRefresh
        ? Math.max(1000, (androidSimsRefreshSec || 1) * 1000)
        : false,
    refetchIntervalInBackground: !androidSimulatorsCollapsed && androidSimsAutoRefresh,
  })

  const creatableTemplatesQuery = useQuery<AndroidCreatableResponse>({
    queryKey: ['android-emulators-creatable'],
    queryFn: async () => {
      const res = await fetch('/api/android/emulators/creatable', {
        method: 'GET',
        headers: defaultHeaders,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to load templates')
      }
      return res.json()
    },
    enabled: createDialogOpen,
    staleTime: 60_000,
  })

  const runningInfo = emulatorQuery.data?.running ?? null
  const runningAvd = runningInfo?.avd ?? null
  const runningSerial = runningInfo?.serial ?? null
  const runningDeviceName = runningInfo?.deviceName ?? null

  const startMutation = useMutation<
    AndroidStartResponse,
    Error,
    { avd: string; headless: boolean; reset?: boolean }
  >({
    mutationFn: async ({ avd, headless, reset }) => {
      const res = await fetch('/api/android/emulators/start', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          avd,
          headless,
          reset,
          randomizeDeviceId: reset,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to start emulator')
      }

      return res.json()
    },
    onSuccess: (data, variables) => {
      const baseMessage =
        data?.message ?? (data?.avd ? `Emulator ${data.avd} started` : 'Emulator started')
      const deviceIdValue = data?.deviceId || data?.randomizedDeviceId || null
      const suffix = deviceIdValue ? ` (Device ID: ${deviceIdValue})` : ''
      toast.success(`${baseMessage}${suffix}`)
      const avdKey = normalizeAvdKey(variables?.avd ?? data?.avd ?? '')
      if (avdKey) {
        const nextDeviceId = deviceIdValue || data?.serial || ''
        if (nextDeviceId) {
          setDeviceIds((current) => ({ ...current, [avdKey]: nextDeviceId }))
        }
      }
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] })
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to start emulator')
    },
    onSettled: () => {
      setActionAvd(null)
    },
  })
  const stopMutation = useMutation<AndroidStopResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/android/emulators/stop', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ serial: runningSerial }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to stop emulator')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? 'Emulator stopped')
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] })
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to stop emulator')
      setPendingStopAvd(null)
      setActionAvd(null)
    },
  })

  const deleteMutation = useMutation<AndroidDeleteResponse, Error, { avd: string }>({
    mutationFn: async ({ avd }) => {
      const res = await fetch(`/api/android/emulators/${encodeURIComponent(avd)}`, {
        method: 'DELETE',
        headers: defaultHeaders,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to delete emulator')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? `Deleted emulator ${data.avd}`)
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] })
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to delete emulator')
    },
    onSettled: () => {
      setDeletingAvd(null)
    },
  })

  const createMutation = useMutation<
    AndroidCreateResponse,
    Error,
    { templateId: string; name?: string }
  >({
    mutationFn: async ({ templateId, name }) => {
      const res = await fetch('/api/android/emulators/create', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ templateId, name }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to create emulator')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? `Created emulator ${data.avd}`)
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] })
      setCreateDialogOpen(false)
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to create emulator')
    },
  })

  useEffect(() => {
    if (!pendingStopAvd) return
    const stillRunning = avdKeysMatch(pendingStopAvd, runningAvd)
    if (!stillRunning) {
      setPendingStopAvd(null)
      setActionAvd((current) => (avdKeysMatch(current, pendingStopAvd) ? null : current))
    }
  }, [pendingStopAvd, runningAvd])

  useEffect(() => {
    if (!createDialogOpen) return
    const templates = creatableTemplatesQuery.data?.templates ?? []
    if (templates.length === 0) return
    if (!selectedTemplateId || !templates.some((tpl) => tpl.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [createDialogOpen, creatableTemplatesQuery.data?.templates, selectedTemplateId])

  const handleStart = useCallback(
    (avd: string) => {
      setActionAvd(avd)
      const avdKey = normalizeAvdKey(avd)
      const shouldReset = !!resetSelections[avdKey]
      startMutation.mutate({
        avd,
        headless: androidHeadless,
        reset: shouldReset,
      })
    },
    [startMutation, androidHeadless, resetSelections]
  )

  const handleStop = useCallback(
    (avd: string) => {
      if (!runningSerial) {
        toast.error('No running emulator detected')
        return
      }
      setActionAvd(avd)
      setPendingStopAvd(avd)
      stopMutation.mutate()
    },
    [runningSerial, stopMutation]
  )

  const handleCreateDialogOpenChange = useCallback(
    (open: boolean) => {
      setCreateDialogOpen(open)
      if (!open) {
        setSelectedTemplateId('')
        setCustomAvdName('')
        createMutation.reset()
      }
    },
    [createMutation]
  )

  const handleDelete = useCallback(
    (avd: string) => {
      if (avdKeysMatch(avd, runningAvd)) {
        toast.error('Stop the emulator before deleting it')
        return
      }
      setDeletingAvd(avd)
      deleteMutation.mutate({ avd })
    },
    [deleteMutation, runningAvd]
  )

  const handleResetToggle = useCallback((avd: string, checked: boolean) => {
    const key = normalizeAvdKey(avd)
    setResetSelections((current) => ({ ...current, [key]: checked }))
  }, [])

  const handleCreateEmulator = useCallback(() => {
    if (!selectedTemplateId) {
      toast.error('Please choose a template')
      return
    }
    createMutation.mutate({
      templateId: selectedTemplateId,
      name: customAvdName.trim() || undefined,
    })
  }, [createMutation, selectedTemplateId, customAvdName])

  const selectedTemplate = useMemo(() => {
    return (
      (creatableTemplatesQuery.data?.templates ?? []).find(
        (template) => template.id === selectedTemplateId
      ) ?? null
    )
  }, [creatableTemplatesQuery.data?.templates, selectedTemplateId])

  const emulatorRows = useMemo(() => {
    return (emulatorQuery.data?.avds ?? []).map((avd) => {
      const isRunning = avdKeysMatch(avd, runningAvd)
      const deviceName = isRunning ? (runningDeviceName ?? avd) : null
      return { avd, isRunning, deviceName }
    })
  }, [emulatorQuery.data?.avds, runningAvd, runningDeviceName])

  const isStarting = startMutation.isPending
  const isStopping = stopMutation.isPending || !!pendingStopAvd
  const isCreating = createMutation.isPending
  useEffect(() => {
    const keys = new Set((emulatorQuery.data?.avds ?? []).map((avd) => normalizeAvdKey(avd)))
    setResetSelections((current) => {
      const filteredEntries = Object.entries(current).filter(([key]) => keys.has(key))
      if (filteredEntries.length === Object.keys(current).length) {
        return current
      }
      const next: Record<string, boolean> = {}
      for (const [key, value] of filteredEntries) {
        next[key] = value
      }
      return next
    })
    setDeviceIds((current) => {
      const filteredEntries = Object.entries(current).filter(([key]) => keys.has(key))
      if (filteredEntries.length === Object.keys(current).length) {
        return current
      }
      const next: Record<string, string> = {}
      for (const [key, value] of filteredEntries) {
        next[key] = value
      }
      return next
    })
  }, [emulatorQuery.data?.avds])

  const iosQuery = useQuery<IosListResponse>({
    queryKey: ['ios-simulators'],
    queryFn: async () => {
      const res = await fetch('/api/ios/devices?availableOnly=false', {
        method: 'GET',
        headers: defaultHeaders,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to fetch iOS simulators')
      }
      return res.json()
    },
    enabled: !iosSimulatorsCollapsed,
  })

  const iosStartMutation = useMutation<IosActionResponse, Error, { udid: string }>({
    mutationFn: async ({ udid }) => {
      const res = await fetch('/api/ios/simulators/start', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ udid }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to start iOS simulator')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? `Simulator ${data?.simulator?.name ?? ''} started`)
      queryClient.invalidateQueries({ queryKey: ['ios-simulators'] })
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to start iOS simulator')
    },
    onSettled: () => {
      setIosActionUdid(null)
    },
  })

  const iosStopMutation = useMutation<IosActionResponse, Error, { udid: string }>({
    mutationFn: async ({ udid }) => {
      const res = await fetch('/api/ios/simulators/stop', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ udid }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to stop iOS simulator')
      }
      return res.json()
    },
    onSuccess: (data) => {
      const label = data?.simulator?.name ?? ''
      toast.success(data?.message ?? (label ? `Simulator ${label} stopped` : 'Simulator stopped'))
      queryClient.invalidateQueries({ queryKey: ['ios-simulators'] })
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to stop iOS simulator')
    },
    onSettled: () => {
      setIosActionUdid(null)
    },
  })

  const handleIosStart = useCallback(
    (udid: string) => {
      setIosActionUdid(udid)
      iosStartMutation.mutate({ udid })
    },
    [iosStartMutation]
  )

  const handleIosStop = useCallback(
    (udid: string) => {
      setIosActionUdid(udid)
      iosStopMutation.mutate({ udid })
    },
    [iosStopMutation]
  )

  const iosIsStarting = iosStartMutation.isPending
  const iosIsStopping = iosStopMutation.isPending

  return (
    <TooltipProvider>
      <div className="flex flex-1 flex-col gap-6 overflow-auto rounded-lg border-2 p-4 shadow-lg">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">Android Devices</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setAndroidDevicesCollapsed((v) => !v)}
                  aria-label={
                    androidDevicesCollapsed ? 'Expand Android Devices' : 'Collapse Android Devices'
                  }
                >
                  {androidDevicesCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {androidDevicesCollapsed ? 'Expand' : 'Collapse'}
              </TooltipContent>
            </Tooltip>
          </div>
          {!androidDevicesCollapsed && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Switch
                    id="android-auto-refresh"
                    checked={androidAutoRefresh}
                    onCheckedChange={(checked) => setAndroidAutoRefresh(!!checked)}
                  />
                  <label htmlFor="android-auto-refresh" className="cursor-pointer select-none">
                    Auto refresh
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="android-refresh-sec" className="text-muted-foreground">
                    Interval
                  </Label>
                  <Input
                    id="android-refresh-sec"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    className="h-8 w-16"
                    value={androidRefreshSec}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (Number.isFinite(n)) {
                        const clamped = Math.min(60, Math.max(1, Math.floor(n)))
                        setAndroidRefreshSec(clamped)
                      } else {
                        setAndroidRefreshSec(3)
                      }
                    }}
                  />
                  <span className="text-muted-foreground">s</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => devicesQuery.refetch().catch(() => {})}
                      aria-label="Refresh Android devices"
                      disabled={devicesQuery.isFetching}
                    >
                      <RefreshCcw
                        className={cn('h-4 w-4', devicesQuery.isFetching && 'animate-spin')}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>Refresh</TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-2 rounded-lg border p-2">
                {devicesQuery.isLoading ? (
                  <div className="p-4 text-sm">Loading Android devices...</div>
                ) : deviceList.length === 0 ? (
                  <div className="p-4 text-sm">No Android devices connected.</div>
                ) : (
                  <GTable
                    caption="List of connected Android devices"
                    headers={['Device ID', 'ADB State']}
                    dataRow={deviceList}
                    onSelectedRow={onSelectedRow}
                  />
                )}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">Android Simulators</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setAndroidSimulatorsCollapsed((v) => !v)}
                  aria-label={
                    androidSimulatorsCollapsed
                      ? 'Expand Android Simulators'
                      : 'Collapse Android Simulators'
                  }
                >
                  {androidSimulatorsCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {androidSimulatorsCollapsed ? 'Expand' : 'Collapse'}
              </TooltipContent>
            </Tooltip>
          </div>
          {!androidSimulatorsCollapsed && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Switch
                    id="android-headless"
                    checked={androidHeadless}
                    onCheckedChange={(checked) => setAndroidHeadless(!!checked)}
                  />
                  <label htmlFor="android-headless" className="cursor-pointer select-none">
                    Headless mode
                  </label>
                </div>
                <div className="text-muted-foreground flex items-center gap-2">
                  <Switch
                    id="android-sims-auto-refresh"
                    checked={androidSimsAutoRefresh}
                    onCheckedChange={(checked) => setAndroidSimsAutoRefresh(!!checked)}
                  />
                  <label htmlFor="android-sims-auto-refresh" className="cursor-pointer select-none">
                    Auto refresh
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="android-sims-refresh-sec" className="text-muted-foreground">
                    Interval
                  </Label>
                  <Input
                    id="android-sims-refresh-sec"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    className="h-8 w-16"
                    value={androidSimsRefreshSec}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      if (Number.isFinite(n)) {
                        const clamped = Math.min(60, Math.max(1, Math.floor(n)))
                        setAndroidSimsRefreshSec(clamped)
                      } else {
                        setAndroidSimsRefreshSec(3)
                      }
                    }}
                  />
                  <span className="text-muted-foreground">s</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => emulatorQuery.refetch().catch(() => {})}
                      aria-label="Refresh Android emulators"
                      disabled={emulatorQuery.isFetching}
                    >
                      <RefreshCcw
                        className={cn('h-4 w-4', emulatorQuery.isFetching && 'animate-spin')}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>Refresh</TooltipContent>
                </Tooltip>
                <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      Create
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Android Emulator</DialogTitle>
                      <DialogDescription>
                        Select a template to create a new Android emulator.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {creatableTemplatesQuery.isLoading ? (
                        <p className="text-muted-foreground text-sm">Loading templates...</p>
                      ) : creatableTemplatesQuery.isError ? (
                        <p className="text-destructive text-sm">
                          {creatableTemplatesQuery.error instanceof Error
                            ? creatableTemplatesQuery.error.message
                            : 'Failed to load templates.'}
                        </p>
                      ) : (creatableTemplatesQuery.data?.templates?.length ?? 0) === 0 ? (
                        <p className="text-muted-foreground text-sm">No templates available.</p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="android-emulator-template">Template</Label>
                            <Select
                              value={selectedTemplateId || undefined}
                              onValueChange={(value) => setSelectedTemplateId(value)}
                            >
                              <SelectTrigger id="android-emulator-template">
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                              <SelectContent>
                                {(creatableTemplatesQuery.data?.templates ?? []).map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedTemplate?.description && (
                              <p className="text-muted-foreground text-xs">
                                {selectedTemplate.description}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="android-emulator-name">Custom Name (optional)</Label>
                            <Input
                              id="android-emulator-name"
                              value={customAvdName}
                              onChange={(event) => setCustomAvdName(event.target.value)}
                              placeholder={selectedTemplate?.defaultName ?? 'pixel-avd'}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isCreating}>
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button
                        type="button"
                        onClick={handleCreateEmulator}
                        disabled={
                          isCreating ||
                          creatableTemplatesQuery.isLoading ||
                          !selectedTemplateId ||
                          (creatableTemplatesQuery.data?.templates?.length ?? 0) === 0 ||
                          creatableTemplatesQuery.isError
                        }
                      >
                        {isCreating ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const running = !!appiumStatusQuery.data?.running
                        if (running) {
                          stopAppiumMutation.mutate()
                        } else {
                          startAppiumMutation.mutate({})
                        }
                      }}
                      className={cn('h-8 w-8 rounded-full p-0')}
                      aria-label={
                        appiumStatusQuery.data?.running
                          ? 'Stop Appium Server'
                          : 'Start Appium Server'
                      }
                      disabled={startAppiumMutation.isPending || stopAppiumMutation.isPending}
                    >
                      <Aperture
                        className={cn(
                          'h-4 w-4',
                          appiumStatusQuery.data?.running ? 'text-green-600' : 'text-red-600'
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    {startAppiumMutation.isPending || stopAppiumMutation.isPending
                      ? 'Processing...'
                      : appiumStatusQuery.data?.running
                        ? 'Appium running. Click to stop'
                        : 'Start Appium Server'}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-2 rounded-lg border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">Name</TableHead>
                      <TableHead className="w-[220px]">UDID</TableHead>
                      <TableHead className="w-[200px]">Device ID</TableHead>
                      <TableHead className="w-[160px] text-center">Reset</TableHead>
                      <TableHead className="w-[160px]">Status</TableHead>
                      <TableHead className="w-[140px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emulatorQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={6}>Loading emulators...</TableCell>
                      </TableRow>
                    )}
                    {!emulatorQuery.isLoading && emulatorRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>No Android simulators found.</TableCell>
                      </TableRow>
                    )}
                    {emulatorRows.map(({ avd, isRunning, deviceName }) => {
                      const isActionTarget = actionAvd === avd || deletingAvd === avd
                      const avdKey = normalizeAvdKey(avd)
                      const resetChecked = !!resetSelections[avdKey]
                      const statusLabel = isActionTarget
                        ? isStarting
                          ? 'Starting...'
                          : isStopping
                            ? 'Stopping...'
                            : isRunning
                              ? 'Running'
                              : 'Stopped'
                        : isRunning
                          ? 'Running'
                          : 'Stopped'
                      const startLabel = isActionTarget && isStarting ? 'Starting...' : 'Start'
                      const stopLabel = isActionTarget && isStopping ? 'Stopping...' : 'Stop'
                      const isDeletingCurrent = deleteMutation.isPending && deletingAvd === avd
                      const deleteLabel = isDeletingCurrent ? 'Deleting...' : 'Delete'
                      return (
                        <TableRow
                          key={avd}
                          className={cn('odd:bg-muted/20 even:bg-muted/40 transition-colors', {
                            'bg-muted/60': isActionTarget,
                          })}
                        >
                          <TableCell className="w-[240px] truncate">{avd}</TableCell>
                          <TableCell className="w-[220px] truncate">
                            {isRunning ? (deviceName ?? 'Booted') : '-'}
                          </TableCell>
                          <TableCell className="w-[200px] truncate">
                            {deviceIds[avdKey] ?? '-'}
                          </TableCell>
                          <TableCell className="w-[160px] text-center">
                            <Checkbox
                              checked={resetChecked}
                              onCheckedChange={(checked) =>
                                handleResetToggle(avd, checked === true)
                              }
                              aria-label={`Reset emulator ${avd} before starting`}
                            />
                          </TableCell>
                          <TableCell className="w-[160px]">{statusLabel}</TableCell>
                          <TableCell className="w-[140px]">
                            <div className="flex justify-end gap-1">
                              {isRunning ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      className="h-8 w-8 rounded-full"
                                      disabled={isStopping || isDeletingCurrent}
                                      onClick={() => handleStop(avd)}
                                      aria-label={`Stop emulator ${avd}`}
                                    >
                                      <Square className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent sideOffset={6}>{stopLabel}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="default"
                                      className="h-8 w-8 rounded-full"
                                      disabled={isStarting || isDeletingCurrent}
                                      onClick={() => handleStart(avd)}
                                      aria-label={`Start emulator ${avd}`}
                                    >
                                      <Play className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent sideOffset={6}>{startLabel}</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 rounded-full"
                                    disabled={!isRunning}
                                    onClick={() => {
                                      const dId =
                                        deviceIds[avdKey] ||
                                        (avdKeysMatch(avd, runningAvd) ? (runningSerial ?? '') : '')
                                      const params = new URLSearchParams()
                                      if (dId) params.set('deviceId', dId)
                                      if (avd) params.set('avd', avd)
                                      router.push(
                                        `/tools/android-inspector${params.toString() ? `?${params}` : ''}`
                                      )
                                    }}
                                    aria-label={`Inspect emulator ${avd}`}
                                  >
                                    <Search className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>Inspect</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    disabled={
                                      isRunning || isDeletingCurrent || isStarting || isStopping
                                    }
                                    onClick={() => handleDelete(avd)}
                                    aria-label={`Delete emulator ${avd}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>{deleteLabel}</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">iOS Simulators</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setIosSimulatorsCollapsed((v) => !v)}
                  aria-label={
                    iosSimulatorsCollapsed ? 'Expand iOS Simulators' : 'Collapse iOS Simulators'
                  }
                >
                  {iosSimulatorsCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {iosSimulatorsCollapsed ? 'Expand' : 'Collapse'}
              </TooltipContent>
            </Tooltip>
          </div>
          {!iosSimulatorsCollapsed && (
            <div className="mt-2 rounded-lg border">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Name</TableHead>
                    <TableHead className="w-[220px]">Runtime</TableHead>
                    <TableHead className="w-[160px]">State</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {iosQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={4}>Loading iOS simulators...</TableCell>
                    </TableRow>
                  )}
                  {!iosQuery.isLoading && (iosQuery.data?.devices?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>No iOS simulators found.</TableCell>
                    </TableRow>
                  )}
                  {(iosQuery.data?.devices ?? []).map((device) => {
                    const udid = device.udid
                    const isRunning = device.state === 'Booted'
                    const isActionTarget = iosActionUdid === udid
                    const statusLabel = isActionTarget
                      ? iosIsStarting
                        ? 'Starting...'
                        : iosIsStopping
                          ? 'Stopping...'
                          : device.state
                      : device.state
                    const startLabel = isActionTarget && iosIsStarting ? 'Starting...' : 'Start'
                    const stopLabel = isActionTarget && iosIsStopping ? 'Stopping...' : 'Stop'
                    return (
                      <TableRow
                        key={udid}
                        className={cn('odd:bg-muted/20 even:bg-muted/40 transition-colors', {
                          'bg-muted/60': isActionTarget,
                        })}
                      >
                        <TableCell className="w-[240px] truncate">{device.name}</TableCell>
                        <TableCell className="w-[220px] truncate">{device.runtime}</TableCell>
                        <TableCell className="w-[160px]">{statusLabel}</TableCell>
                        <TableCell className="w-[140px]">
                          <div className="flex justify-end gap-1">
                            {isRunning ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    disabled={iosIsStopping}
                                    onClick={() => handleIosStop(udid)}
                                    aria-label={`Stop iOS simulator ${device.name}`}
                                  >
                                    <Square className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>{stopLabel}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="default"
                                    className="h-8 w-8 rounded-full"
                                    disabled={iosIsStarting}
                                    onClick={() => handleIosStart(udid)}
                                    aria-label={`Start iOS simulator ${device.name}`}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>{startLabel}</TooltipContent>
                              </Tooltip>
                            )}
                            {/* iOS inspector not implemented yet; keep icon for visual parity */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-full"
                                  disabled
                                  aria-label={`Inspect iOS simulator ${device.name}`}
                                >
                                  <Search className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={6}>
                                Inspect (Not supported)
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  disabled
                                  aria-label={`Delete iOS simulator ${device.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={6}>Delete (Not supported)</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
