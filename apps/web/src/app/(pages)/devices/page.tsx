'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { GTable } from './components/g-table'
import { toast } from 'sonner'
const headers = { 'Content-Type': 'application/json' }

type AndroidEmulatorResponse = {
  avds: string[]
  running: { serial: string; avd: string | null; deviceName: string | null } | null
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
  const [androidHeadless, setAndroidHeadless] = useState(false)
  const queryClient = useQueryClient()

  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () =>
      fetch(`/api/android/devices`, {
        method: 'GET',
        headers: { ...headers },
      }).then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch devices')
        }
        return res.json()
      }),
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
      .filter((v: string) => v !== '')
      .filter((v: string) => v.endsWith('device'))
    const rows = dlist.map((line: string) => line.split('\t'))
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
        headers,
      })
      if (!res.ok) {
        throw new Error('Failed to fetch emulators')
      }
      return res.json()
    },
  })

  const runningInfo = emulatorQuery.data?.running ?? null
  const runningAvd = runningInfo?.avd ?? null
  const runningSerial = runningInfo?.serial ?? null
  const runningDeviceName = runningInfo?.deviceName ?? null

  const startMutation = useMutation<
    AndroidStartResponse,
    Error,
    { avd: string; headless: boolean }
  >({
    mutationFn: async ({ avd, headless }) => {
      const res = await fetch('/api/android/emulators/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ avd, headless }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to start emulator')
      }

      return res.json()
    },
    onSuccess: (data) => {
      toast.success(
        data?.message ?? (data?.avd ? `Emulator ${data.avd} started` : 'Emulator started')
      )
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
        headers,
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
    },
    onSettled: () => {
      setActionAvd(null)
    },
  })

  const handleStart = useCallback(
    (avd: string) => {
      setActionAvd(avd)
      startMutation.mutate({ avd, headless: androidHeadless })
    },
    [startMutation, androidHeadless]
  )

  const handleStop = useCallback(
    (avd: string) => {
      if (!runningSerial) {
        toast.error('No running emulator detected')
        return
      }
      setActionAvd(avd)
      stopMutation.mutate()
    },
    [runningSerial, stopMutation]
  )

  const emulatorRows = useMemo(() => {
    const normalize = (value: string | null | undefined) =>
      value?.replace(/[\s_-]/g, '').toLowerCase() ?? ''
    const runningKey = normalize(runningAvd)
    return (emulatorQuery.data?.avds ?? []).map((avd) => {
      const avdKey = normalize(avd)
      const isRunning = runningKey
        ? avdKey === runningKey || avdKey.includes(runningKey) || runningKey.includes(avdKey)
        : false
      const deviceName = isRunning ? runningDeviceName ?? avd : null
      return { avd, isRunning, deviceName }
    })
  }, [emulatorQuery.data?.avds, runningAvd, runningDeviceName])

  const isStarting = startMutation.isPending
  const isStopping = stopMutation.isPending

  const iosQuery = useQuery<IosListResponse>({
    queryKey: ['ios-simulators'],
    queryFn: async () => {
      const res = await fetch('/api/ios/devices?availableOnly=false', {
        method: 'GET',
        headers,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to fetch iOS simulators')
      }
      return res.json()
    },
  })

  const iosStartMutation = useMutation<IosActionResponse, Error, { udid: string }>({
    mutationFn: async ({ udid }) => {
      const res = await fetch('/api/ios/simulators/start', {
        method: 'POST',
        headers,
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
        headers,
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
    <div className="flex flex-1 flex-col gap-6 rounded-lg border-2 p-4 shadow-lg">
      <div>
        <span className="text-lg font-medium">Android Simulators</span>
        <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
          <Switch
            id="android-headless"
            checked={androidHeadless}
            onCheckedChange={(checked) => setAndroidHeadless(!!checked)}
          />
          <label htmlFor="android-headless" className="cursor-pointer select-none">
            Headless mode
          </label>
        </div>
        <div className="mt-2 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>DeviceName</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emulatorQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={3}>Loading emulators...</TableCell>
                </TableRow>
              )}
              {!emulatorQuery.isLoading && emulatorRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No Android simulators found.</TableCell>
                </TableRow>
              )}
              {emulatorRows.map(({ avd, isRunning, deviceName }) => {
                const isActionTarget = actionAvd === avd
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
                const buttonStyle = { minWidth: '84px' }

                return (
                  <TableRow key={avd}>
                    <TableCell>{avd}</TableCell>
                    <TableCell>{isRunning ? deviceName ?? 'Booted' : '-'}</TableCell>
                    <TableCell>{statusLabel}</TableCell>
                    <TableCell className="text-right">
                      {isRunning ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isStopping}
                          onClick={() => handleStop(avd)}
                          style={buttonStyle}
                        >
                          {stopLabel}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isStarting}
                          onClick={() => handleStart(avd)}
                          style={buttonStyle}
                        >
                          {startLabel}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <span className="text-lg font-medium">iOS Simulators</span>
        <div className="mt-2 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                const buttonStyle = { minWidth: '84px' }

                return (
                  <TableRow key={udid}>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{device.runtime}</TableCell>
                    <TableCell>{statusLabel}</TableCell>
                    <TableCell className="text-right">
                      {isRunning ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={iosIsStopping}
                          onClick={() => handleIosStop(udid)}
                          style={buttonStyle}
                        >
                          {stopLabel}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={iosIsStarting}
                          onClick={() => handleIosStart(udid)}
                          style={buttonStyle}
                        >
                          {startLabel}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
