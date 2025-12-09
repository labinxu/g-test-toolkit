'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import {
  Loader2,
  PackagePlus,
  RefreshCcw,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'

type FileNode = {
  name: string
  path: string
  isDirectory: boolean
  createdAt?: string | null
  children?: FileNode[]
}

type AndroidDeviceInfo = {
  serial?: string
  state?: string
}

type AndroidDevicesResponse = {
  devices?: string
  list?: AndroidDeviceInfo[]
}

const APP_FILES_QUERY_KEY = ['app-files']
const ANDROID_DEVICES_QUERY_KEY = ['android-device-list']

async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' })
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as { token?: string }
    return data?.token ?? null
  } catch (error) {
    console.error('Failed to fetch CSRF token', error)
    return null
  }
}

function flattenFileNodes(nodes: FileNode[] = []): FileNode[] {
  const result: FileNode[] = []
  for (const node of nodes) {
    if (node.isDirectory) {
      if (node.children?.length) {
        result.push(...flattenFileNodes(node.children))
      }
    } else {
      result.push(node)
    }
  }
  return result
}

async function extractErrorMessage(res: Response, fallback: string) {
  try {
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = await res.json()
      const message = data?.message ?? data?.error
      if (Array.isArray(message)) {
        return message.join(', ')
      }
      if (typeof message === 'string' && message.length > 0) {
        return message
      }
      return fallback
    }
    const text = await res.text()
    return text || fallback
  } catch {
    return fallback
  }
}

export default function AppTestCasesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [installDialogOpen, setInstallDialogOpen] = useState(false)
  const [pendingInstallFile, setPendingInstallFile] = useState<FileNode | null>(null)
  const [selectedSerials, setSelectedSerials] = useState<string[]>([])
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const v = localStorage.getItem('gtt:testcases-app:autoRefresh')
      return v == null ? true : v === '1' || v === 'true'
    } catch {}
    return true
  })
  const [forceInstall, setForceInstall] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const v = localStorage.getItem('gtt:testcases-app:forceInstall')
      return v === '1' || v === 'true'
    } catch {}
    return false
  })
  const AUTO_REFRESH_MS = 3000
  // Persist auto-refresh setting
  useEffect(() => {
    try {
      localStorage.setItem('gtt:testcases-app:autoRefresh', autoRefresh ? '1' : '0')
    } catch {}
  }, [autoRefresh])
  // Persist force-install setting
  useEffect(() => {
    try {
      localStorage.setItem('gtt:testcases-app:forceInstall', forceInstall ? '1' : '0')
    } catch {}
  }, [forceInstall])

  const appsQuery = useQuery<FileNode[]>({
    queryKey: APP_FILES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/testcase/listapps?depth=1', {
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Failed to fetch app files')
      }
      const data = (await res.json()) as FileNode[] | { data?: FileNode[] }
      if (Array.isArray(data)) {
        return data
      }
      if (Array.isArray((data as { data?: FileNode[] }).data)) {
        return (data as { data: FileNode[] }).data
      }
      return []
    },
    refetchOnWindowFocus: false,
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
  })

  const androidDevicesQuery = useQuery<AndroidDevicesResponse>({
    queryKey: ANDROID_DEVICES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/android/devices', {
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Failed to fetch Android devices')
      }
      return res.json() as Promise<AndroidDevicesResponse>
    },
    refetchOnWindowFocus: false,
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
  })

  const deleteMutation = useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (filePath: string) => {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/files/apps', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ path: filePath }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Failed to delete file')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('File deleted successfully')
      queryClient.invalidateQueries({ queryKey: APP_FILES_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete file')
    },
  })

  const uploadMutation = useMutation<{ success: boolean }, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/files/apps/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: formData,
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Failed to upload file')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Upload succeeded')
      queryClient.invalidateQueries({ queryKey: APP_FILES_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload file')
    },
  })

  const files = useMemo(
    () => flattenFileNodes(Array.isArray(appsQuery.data) ? appsQuery.data : []),
    [appsQuery.data]
  )

  const availableDeviceSerials = useMemo(() => {
    const serials = new Set<string>()

    const devicesOutput = androidDevicesQuery.data?.devices ?? ''
    devicesOutput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.endsWith('device'))
      .forEach((line) => {
        const serial = line.split(/\s+/)[0]
        if (serial) serials.add(serial)
      })

    androidDevicesQuery.data?.list?.forEach((device) => {
      const serial = device.serial?.trim()
      const state = device.state?.toLowerCase()
      if (serial && state === 'device') {
        serials.add(serial)
      }
    })

    return Array.from(serials)
  }, [androidDevicesQuery.data?.devices, androidDevicesQuery.data?.list])

  const formatCreatedAt = useCallback((value?: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return '-'
    }
    return date.toLocaleString()
  }, [])

  const triggerFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDelete = useCallback(
    (file: FileNode) => {
      const confirmed = window.confirm(`Delete ${file.name}?`)
      if (!confirmed) return
      deleteMutation.mutate(file.path)
    },
    [deleteMutation]
  )

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target
      const file = input.files?.[0]
      if (!file) return
      const formData = new FormData()
      formData.append('file', file)
      uploadMutation.mutate(formData, {
        onSettled: () => {
          input.value = ''
        },
      })
    },
    [uploadMutation]
  )

  const closeInstallDialog = useCallback(() => {
    setInstallDialogOpen(false)
    setPendingInstallFile(null)
    setSelectedSerials([])
  }, [])

  type InstallAppRequest = { filePath: string; serials: string[]; force?: boolean }
  type InstallAppResponse = {
    result: string
    installed?: number
    serials?: string[]
    message?: string
  }

  const installMutation = useMutation<InstallAppResponse, Error, InstallAppRequest>({
    mutationFn: async ({ filePath, serials }) => {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/testcase/apps/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ filePath, serials, force: !!forceInstall }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Failed to install app')
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? 'Install request submitted')
      closeInstallDialog()
      androidDevicesQuery.refetch().catch(() => {})
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to install app')
      if (!installDialogOpen) {
        setPendingInstallFile(null)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: APP_FILES_QUERY_KEY })
    },
  })

  const hasAvailableDevices = availableDeviceSerials.length > 0

  const handleInstall = useCallback(
    (file: FileNode) => {
      if (!hasAvailableDevices || installMutation.isPending) {
        return
      }
      setPendingInstallFile(file)
      if (availableDeviceSerials.length === 1) {
        installMutation.mutate({
          filePath: file.path,
          serials: availableDeviceSerials,
          force: !!forceInstall,
        })
      } else {
        setSelectedSerials(availableDeviceSerials)
        setInstallDialogOpen(true)
      }
    },
    [hasAvailableDevices, installMutation, availableDeviceSerials, forceInstall]
  )

  const toggleSerialSelection = useCallback((serial: string, checked: boolean) => {
    setSelectedSerials((prev) => {
      if (checked) {
        if (prev.includes(serial)) return prev
        return [...prev, serial]
      }
      return prev.filter((item) => item !== serial)
    })
  }, [])

  const submitInstall = useCallback(() => {
    if (!pendingInstallFile || selectedSerials.length === 0) return
    installMutation.mutate({
      filePath: pendingInstallFile.path,
      serials: selectedSerials,
      force: !!forceInstall,
    })
  }, [installMutation, pendingInstallFile, selectedSerials, forceInstall])

  const isRefreshing = appsQuery.isFetching || androidDevicesQuery.isFetching

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">App Test Files</h2>
            <p className="text-sm text-muted-foreground">Manage uploaded app test packages</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground mr-2 flex items-center gap-2">
              <Switch id="apps-auto-refresh" checked={autoRefresh} onCheckedChange={(v) => setAutoRefresh(!!v)} />
              <label htmlFor="apps-auto-refresh" className="cursor-pointer select-none text-sm">Auto refresh</label>
            </div>
            <div className="text-muted-foreground mr-2 flex items-center gap-2">
              <Switch id="apps-force-install" checked={forceInstall} onCheckedChange={(v) => setForceInstall(!!v)} />
              <label htmlFor="apps-force-install" className="cursor-pointer select-none text-sm">Force install</label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                appsQuery.refetch()
                androidDevicesQuery.refetch()
              }}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={triggerFileDialog}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Upload File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
        <div className="mt-2 overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">NO.</TableHead>
                <TableHead>FileName</TableHead>
                <TableHead className="w-48">Create Time</TableHead>
                <TableHead className="w-56 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No files yet. Upload a test package to begin.
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file, index) => (
                  <TableRow key={file.path}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="truncate">{file.name}</TableCell>
                    <TableCell>{formatCreatedAt(file.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="w-[104px] justify-center"
                          onClick={() => handleInstall(file)}
                          disabled={!hasAvailableDevices || installMutation.isPending}
                          variant="secondary"
                        >
                          {installMutation.isPending && pendingInstallFile?.path === file.path ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <PackagePlus className="mr-2 h-4 w-4" />
                          )}
                          Install
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-[104px] justify-center"
                          onClick={() => handleDelete(file)}
                          disabled={deleteMutation.isPending || installMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog
        open={installDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeInstallDialog()
          } else {
            setInstallDialogOpen(true)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select devices</DialogTitle>
            <DialogDescription>
              Choose the Android devices to install{' '}
              <span className="font-medium">{pendingInstallFile?.name ?? ''}</span> on.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-64 pr-2">
            <div className="space-y-3 py-2">
              {availableDeviceSerials.map((serial) => {
                const checkboxId = `install-serial-${serial}`
                const checked = selectedSerials.includes(serial)
                return (
                  <div key={serial} className="flex items-center gap-3 rounded-md border p-3">
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(value) => toggleSerialSelection(serial, value === true)}
                      disabled={installMutation.isPending}
                    />
                    <Label htmlFor={checkboxId} className="cursor-pointer select-none">
                      {serial}
                    </Label>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={closeInstallDialog}
              disabled={installMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitInstall}
              disabled={selectedSerials.length === 0 || installMutation.isPending}
              className="w-[120px] justify-center"
            >
              {installMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                'Install'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
