'use client'

import { useMemo, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Activity,
  FileScan,
  ListRestart,
  PackagePlus,
  Play,
  RouteOff,
  Server,
  ServerOff,
  SlidersHorizontal,
  Square,
  Unplug,
} from 'lucide-react'
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
import { DeviceControls, type DevicePollState } from './device-controls'
import { cn } from '@/lib/utils'

type TypesState = {
  open: boolean
  globals: string[]
  relatives: string[]
  onOpenChange: (open: boolean) => void
  onSelectRelative: (path: string) => void
  onRefresh: () => void
}

type DeviceState = {
  devicePollEnabled: boolean
  devicePollState: DevicePollState
  deviceIds: string[]
  selectedDeviceId: string
  appiumAutoRefresh: boolean
  onTogglePolling: (enabled: boolean) => void
  onSelectDevice: (id: string) => void
  onAppiumRunning?: () => void
}

type Props = {
  running: boolean
  canRun: boolean
  onRunClick: () => void
  buildingLibs: boolean
  onBuildLibs: () => void
  keepAppOpen: boolean
  onToggleKeepAppOpen: () => void
  onCloseMine: () => void
  onCloseAll: () => void
  connected: boolean
  paramsRef: RefObject<ParametersFormHandle | null>
  deviceState: DeviceState
  typesState: TypesState
}

export function EditorToolbar({
  running,
  canRun,
  onRunClick,
  buildingLibs,
  onBuildLibs,
  keepAppOpen,
  onToggleKeepAppOpen,
  onCloseMine,
  onCloseAll,
  connected,
  paramsRef,
  deviceState,
  typesState,
}: Props) {
  const { devicePollEnabled, devicePollState, deviceIds, selectedDeviceId, appiumAutoRefresh } =
    deviceState

  const connectionTooltip = useMemo(
    () => (connected ? 'Connected' : 'Disconnected'),
    [connected]
  )

  return (
    <div className="flex flex-row">
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={running ? 'destructive' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onRunClick}
              disabled={!canRun}
              aria-label={running ? 'Stop' : 'Execute'}
            >
              {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>{running ? 'Stop' : 'Execute'}</TooltipContent>
        </Tooltip>

        <DeviceControls
          devicePollEnabled={devicePollEnabled}
          devicePollState={devicePollState}
          deviceIds={deviceIds}
          selectedDeviceId={selectedDeviceId}
          appiumAutoRefresh={appiumAutoRefresh}
          onTogglePolling={deviceState.onTogglePolling}
          onSelectDevice={deviceState.onSelectDevice}
          onAppiumRunning={deviceState.onAppiumRunning}
          className="ml-1"
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 h-8 w-8 rounded-full"
              disabled={buildingLibs}
              onClick={onBuildLibs}
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
              onClick={typesState.onRefresh}
              aria-label="Refresh types"
            >
              <ListRestart className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>Refresh Types</TooltipContent>
        </Tooltip>

        <Tooltip>
          <Dialog open={typesState.open} onOpenChange={typesState.onOpenChange}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-8 w-8 rounded-full"
                onClick={() => typesState.onOpenChange(true)}
                aria-label="Show types"
              >
                <FileScan className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Loaded Types</DialogTitle>
                <DialogDescription className="sr-only">
                  Lists loaded global typings and relative import paths.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-3 overflow-auto">
                <div>
                  <div className="mb-1 text-sm font-medium">
                    Global typings ({typesState.globals.length})
                  </div>
                  <ul className="text-xs">
                    {typesState.globals.map((p) => (
                      <li key={p} className="truncate">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-sm font-medium">
                    Relative imports ({typesState.relatives.length})
                  </div>
                  <ul className="text-xs">
                    {typesState.relatives.map((p) => (
                      <li key={p} className="truncate">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => typesState.onSelectRelative(p)}
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
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('ml-1 h-8 w-8 rounded-full', keepAppOpen ? 'text-green-600' : '')}
              onClick={onToggleKeepAppOpen}
              aria-label="Keep App Open"
            >
              <Activity className={cn('h-4 w-4', keepAppOpen ? 'text-green-600' : 'text-yellow-600')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>Keep App Open {keepAppOpen ? '(On)' : '(Off)'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 h-8 w-8 rounded-full text-yellow-600 hover:text-yellow-700 focus-visible:ring-2 focus-visible:ring-red-500 active:text-red-800"
              onClick={onCloseMine}
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
              onClick={onCloseAll}
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
          <TooltipContent sideOffset={6}>{connectionTooltip}</TooltipContent>
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
	                  <DialogDescription className="sr-only">
	                    Configure parameters used by the editor and runtime.
	                  </DialogDescription>
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
  )
}
