'use client'

import React, { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import { Loader2, Play, RefreshCcw, Trash2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { normalizeResponseError } from '@/lib/error'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type FileNode = {
  name: string
  path: string
  isDirectory: boolean
  createdAt?: string | null
  children?: FileNode[]
}

const VIDEO_FILES_QUERY_KEY = ['video-files']

async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' })
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as { token?: string }
    return data?.token ?? null
  } catch {
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

export default function VideosResourcePage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false)
  const [selectedVideo, setSelectedVideo] = useState<FileNode | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [dialogOffset, setDialogOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartRef = useRef<{
    x: number
    y: number
    originX: number
    originY: number
  } | null>(null)
  const AUTO_REFRESH_MS = 5000

  const videosQuery = useQuery<FileNode[]>({
    queryKey: VIDEO_FILES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/files/videos?depth=1', {
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        throw new Error(err.message || 'Failed to fetch videos')
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

  const deleteMutation = useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (filePath: string) => {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/files/videos', {
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
        throw new Error(err.message || 'Failed to delete video')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Video deleted')
      queryClient.invalidateQueries({ queryKey: VIDEO_FILES_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete video')
    },
  })

  const uploadMutation = useMutation<{ success: boolean }, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/files/videos/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: formData,
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        throw new Error(err.message || 'Failed to upload video')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Video uploaded')
      queryClient.invalidateQueries({ queryKey: VIDEO_FILES_QUERY_KEY })
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload video')
    },
  })

  const files = useMemo(
    () => flattenFileNodes(Array.isArray(videosQuery.data) ? videosQuery.data : []),
    [videosQuery.data]
  )

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

  const isRefreshing = videosQuery.isFetching

  const handlePlay = useCallback((file: FileNode) => {
    setSelectedVideo(file)
    setPlayerOpen(true)
  }, [])

  const selectedVideoUrl = useMemo(() => {
    if (!selectedVideo) return ''
    return `/api/files/raw?path=${encodeURIComponent(selectedVideo.path)}`
  }, [selectedVideo])

  const handlePlayerOpenChange = useCallback((open: boolean) => {
    setPlayerOpen(open)
    if (!open) {
      setDialogOffset({ x: 0, y: 0 })
    }
  }, [])

  const handleDialogDragStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const start = {
        x: event.clientX,
        y: event.clientY,
        originX: dialogOffset.x,
        originY: dialogOffset.y,
      }
      dragStartRef.current = start
      const handleMove = (ev: MouseEvent) => {
        if (!dragStartRef.current) return
        const dx = ev.clientX - dragStartRef.current.x
        const dy = ev.clientY - dragStartRef.current.y
        setDialogOffset({
          x: dragStartRef.current.originX + dx,
          y: dragStartRef.current.originY + dy,
        })
      }
      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
        dragStartRef.current = null
      }
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [dialogOffset.x, dialogOffset.y]
  )

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col gap-2">
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Videos</h2>
            <p className="text-sm text-muted-foreground">
              上传和管理保存在 <code>workspace/videos</code> 下的视频文件
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="mr-2 flex items-center gap-2 text-muted-foreground">
              <Label htmlFor="videos-auto-refresh" className="cursor-pointer select-none text-sm">
                Auto refresh
              </Label>
              <input
                id="videos-auto-refresh"
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => videosQuery.refetch()}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              size="sm"
              onClick={triggerFileDialog}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-lg border bg-card p-4 shadow-sm">
        <ScrollArea className="h-full w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[72px]">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videosQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    暂无视频文件，请先上传。
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file, index) => (
                  <TableRow key={file.path}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="truncate">{file.name}</TableCell>
                    <TableCell>{formatCreatedAt(file.createdAt)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => handlePlay(file)}
                            disabled={deleteMutation.isPending || uploadMutation.isPending}
                            aria-label="播放视频"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>播放</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => handleDelete(file)}
                            disabled={deleteMutation.isPending || uploadMutation.isPending}
                            aria-label="删除视频"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>删除</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      <Dialog open={playerOpen} onOpenChange={handlePlayerOpenChange}>
        <DialogContent
          className="max-w-3xl cursor-move"
          style={{
            transform: `translate(-50%, -50%) translate(${dialogOffset.x}px, ${dialogOffset.y}px)`,
          }}
          onMouseDown={handleDialogDragStart}
        >
          {selectedVideo && selectedVideoUrl && (
            <>
              <DialogHeader>
                <DialogTitle>播放视频：{selectedVideo.name}</DialogTitle>
              </DialogHeader>
              <div className="mt-2">
                <video
                  key={selectedVideo.path}
                  src={selectedVideoUrl}
                  controls
                  autoPlay
                  className="h-auto w-full max-h-[70vh] rounded-md bg-black"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  )
}
