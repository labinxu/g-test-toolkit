'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Aperture } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type AppiumStatus = { running: boolean; port?: number }

export function AppiumToggleButton({
  className,
  onAfterChange,
  disabled,
  queryKey,
  pollIntervalMs,
}: {
  className?: string
  onAfterChange?: (running: boolean, port?: number) => void
  disabled?: boolean
  queryKey?: any
  /**
   * Polling interval for status query. Set to false to disable polling.
   * Defaults to 5000 ms.
   */
  pollIntervalMs?: number | false
}) {
  const statusQuery = useQuery<AppiumStatus>({
    queryKey: queryKey ?? ['appium-status'],
    queryFn: async () => {
      const res = await fetch('/api/android/appium/status', { method: 'GET' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    staleTime: 5000,
    refetchOnWindowFocus: false,
    refetchInterval: pollIntervalMs === false ? false : (typeof pollIntervalMs === 'number' ? Math.max(1000, pollIntervalMs) : 5000),
    refetchIntervalInBackground: pollIntervalMs !== false,
  })

  const startMutation = useMutation<{ result: string; started?: boolean; port?: number }, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/android/appium/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: async (data) => {
      toast.success(data?.port ? `Appium server started on ${data.port}` : 'Appium started')
      await statusQuery.refetch()
      onAfterChange?.(true, data?.port)
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to start Appium'),
  })

  const stopMutation = useMutation<{ result: string; stopped?: boolean }, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/android/appium/stop', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: async (data) => {
      toast.success(data?.stopped ? 'Appium stopped' : 'Appium not running')
      await statusQuery.refetch()
      onAfterChange?.(false)
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to stop Appium'),
  })

  const running = !!statusQuery.data?.running
  const busy = startMutation.isPending || stopMutation.isPending
  const isDisabled = !!disabled || busy

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={() => (running ? stopMutation.mutate() : startMutation.mutate())}
          disabled={isDisabled}
          size={'icon'}
          variant={'ghost'}
          className={cn('h-8 w-8 rounded-full p-0', isDisabled && 'opacity-50 cursor-not-allowed', className)}
          aria-label={running ? 'Stop Appium Server' : 'Start Appium Server'}
        >
          <Aperture className={cn('h-4 w-4', running ? 'text-green-600' : 'text-red-600')} />
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>
        {busy ? 'Handling' : running ? 'Appium running. Click to stop' : 'Start Appium'}
      </TooltipContent>
    </Tooltip>
  )
}
