'use client'

import { useMemo, useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { AppiumToggleButton } from '@/components/appium-toggle-button'
import { Smartphone, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DevicePollState = 'idle' | 'loading' | 'ready'

type Props = {
  devicePollEnabled: boolean
  devicePollState: DevicePollState
  deviceIds: string[]
  selectedDeviceId: string
  appiumAutoRefresh: boolean
  onTogglePolling: (enabled: boolean) => void
  onSelectDevice: (id: string) => void
  onAppiumRunning?: () => void
  className?: string
}

export function DeviceControls({
  devicePollEnabled,
  devicePollState,
  deviceIds,
  selectedDeviceId,
  appiumAutoRefresh,
  onTogglePolling,
  onSelectDevice,
  onAppiumRunning,
  className,
}: Props) {
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false)

  const tooltipText = useMemo(() => {
    if (!devicePollEnabled) return '启用设备/Appium轮询'
    if (selectedDeviceId) return `Device: ${selectedDeviceId}`
    if (devicePollState === 'loading') return '正在获取设备列表…'
    return '未选择设备'
  }, [devicePollEnabled, devicePollState, selectedDeviceId])

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <AppiumToggleButton
        queryKey={['appium-status', 'testcases']}
        pollIntervalMs={devicePollEnabled && appiumAutoRefresh ? 5000 : false}
        enabled={devicePollEnabled}
        onStatusChange={(running) => {
          if (devicePollEnabled && running) {
            onAppiumRunning?.()
          }
        }}
      />
      <Tooltip>
        <DropdownMenu
          open={devicePollEnabled && deviceMenuOpen}
          onOpenChange={(open) => {
            if (!devicePollEnabled) return
            setDeviceMenuOpen(open)
          }}
        >
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 rounded-full"
                aria-label="Toggle device polling"
                onClick={() => {
                  const next = !devicePollEnabled
                  onTogglePolling(next)
                  if (next) {
                    setDeviceMenuOpen(true)
                  } else {
                    setDeviceMenuOpen(false)
                  }
                }}
              >
                <Smartphone
                  className={cn(
                    'h-4 w-4',
                    !devicePollEnabled
                      ? 'text-gray-400'
                      : devicePollState === 'ready'
                        ? 'text-green-500'
                        : 'text-white'
                  )}
                />
                {devicePollEnabled && devicePollState === 'ready' ? (
                  <span
                    aria-hidden
                    className="ring-background absolute -top-0.5 -right-0.5 inline-block h-2 w-2 rounded-full bg-green-500 ring-2"
                  />
                ) : null}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent
            align="start"
            className="w-44"
            sideOffset={4}
            hidden={!devicePollEnabled}
            onEscapeKeyDown={() => setDeviceMenuOpen(false)}
            onPointerDownOutside={() => setDeviceMenuOpen(false)}
            onInteractOutside={() => setDeviceMenuOpen(false)}
          >
            {deviceIds.length ? (
              deviceIds.map((id) => (
                <DropdownMenuItem
                  key={id}
                  onClick={() => {
                    onSelectDevice(id)
                    setDeviceMenuOpen(false)
                  }}
                >
                  {selectedDeviceId === id ? (
                    <Check className="mr-2 h-4 w-4 text-green-600" />
                  ) : (
                    <span className="mr-2 inline-block h-4 w-4" />
                  )}
                  <span className={selectedDeviceId === id ? 'font-medium text-green-700' : ''}>
                    {id}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No devices</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent sideOffset={6}>{tooltipText}</TooltipContent>
      </Tooltip>
    </div>
  )
}
