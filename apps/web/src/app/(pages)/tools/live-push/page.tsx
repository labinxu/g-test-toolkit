'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Cast, Loader2, RefreshCcw, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/app/context/session-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select'
import { ensureResponseOk } from '@/lib/error'

type LiveStatus = {
  running: boolean
  inputPath?: string
  rtmpUrl?: string
  startedAt?: string
  pid?: number | null
  lastError?: string | null
  progressSec?: number
  durationSec?: number
}

type FileNode = {
  name: string
  path: string
  isDirectory: boolean
  createdAt?: string | null
  children?: FileNode[]
}

export default function LivePushToolPage() {
  const { isAuthenticated } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams?.toString() ?? ''
  const redirectToSignin = useCallback(() => {
    const currentPath = pathname || '/'
    const fullPath = searchParamsString ? `${currentPath}?${searchParamsString}` : currentPath
    const safePath = fullPath && !fullPath.startsWith('/signin') ? fullPath : '/'
    const query = safePath ? `?redirect=${encodeURIComponent(safePath)}` : ''
    router.push(`/signin${query}`)
  }, [pathname, router, searchParamsString])
  const [rtmpServer, setRtmpServer] = useState('rtmp://global-live.gettr.com:5222/app')
  const [streamKey, setStreamKey] = useState('')
  const [videoBitrate, setVideoBitrate] = useState(800)
  const [audioBitrate, setAudioBitrate] = useState(96)

  const [status, setStatus] = useState<LiveStatus | null>(null)
  const [loadingStart, setLoadingStart] = useState(false)
  const [loadingStop, setLoadingStop] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [videoOptions, setVideoOptions] = useState<OptionsSelectItem<string>[]>([])
  const [selectedVideo, setSelectedVideo] = useState<string>('')

  const rtmpUrl = useMemo(() => {
    const server = rtmpServer.trim().replace(/\/+$/, '')
    const key = streamKey.trim()
    if (!server || !key) return ''
    return `${server}/${key}`
  }, [rtmpServer, streamKey])

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/live/status', { cache: 'no-store' })
      await ensureResponseOk(res, {
        defaultMessage: '获取推流状态失败',
        onUnauthorized: redirectToSignin,
      })
      const data = (await res.json()) as LiveStatus | { error?: string }
      if ((data as any)?.error) {
        throw new Error((data as any)?.error || '获取推流状态失败')
      }
      setStatus(data as LiveStatus)
    } catch (e: any) {
      setStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }, [redirectToSignin])

  useEffect(() => {
    fetchStatus().catch(() => {})
  }, [fetchStatus])

  const loadVideos = useCallback(async () => {
    try {
      const res = await fetch('/api/files/videos?depth=1', {
        credentials: 'include',
      })
      await ensureResponseOk(res, {
        defaultMessage: '获取视频列表失败',
        onUnauthorized: redirectToSignin,
      })
      const data = (await res.json()) as FileNode[] | { data?: FileNode[] }
      const list: FileNode[] = Array.isArray(data)
        ? data
        : Array.isArray((data as { data?: FileNode[] }).data)
          ? (data as { data: FileNode[] }).data
          : []
      const flat: FileNode[] = []
      const walk = (nodes: FileNode[]) => {
        for (const n of nodes) {
          if (n.isDirectory && n.children?.length) {
            walk(n.children)
          } else if (!n.isDirectory) {
            flat.push(n)
          }
        }
      }
      walk(list)
      flat.sort((a, b) => a.name.localeCompare(b.name))
      const options: OptionsSelectItem<string>[] = flat.map((f) => ({
        label: f.name,
        value: f.path,
      }))
      setVideoOptions(options)
      if (!selectedVideo && options.length > 0) {
        setSelectedVideo(options[0].value)
      }
    } catch (e) {
      console.error(e)
    }
  }, [redirectToSignin, selectedVideo])

  useEffect(() => {
    loadVideos().catch(() => {})
  }, [loadVideos])

  // 推流运行时，定时轮询后台进度，便于在页面看到实时时间点
  const running = !!status?.running
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      fetchStatus().catch(() => {})
    }, 2000)
    return () => clearInterval(timer)
  }, [running, fetchStatus])

  const formatTime = (value?: number) => {
    if (!Number.isFinite(value as number)) return '(未知)'
    const total = Math.max(0, Math.floor(value as number))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  }

  const handleStart = async () => {
    if (!isAuthenticated) {
      toast.error('请先登录后再启动推流')
      return
    }
    if (!selectedVideo) {
      toast.error('请选择一个视频文件')
      return
    }
    if (!rtmpUrl) {
      toast.error('请填写 RTMP Server 和 Stream Key 或直接填 rtmpUrl')
      return
    }
    setLoadingStart(true)
    try {
      const body = {
        inputPath: selectedVideo,
        rtmpServer: rtmpServer.trim() || undefined,
        streamKey: streamKey.trim() || undefined,
        rtmpUrl,
        videoBitrateKbps: Number.isFinite(videoBitrate) ? videoBitrate : 800,
        audioBitrateKbps: Number.isFinite(audioBitrate) ? audioBitrate : 96,
      }
      const res = await fetch('/api/live/start', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      await ensureResponseOk(res, {
        defaultMessage: '启动推流失败',
        onUnauthorized: redirectToSignin,
      })
      const data = (await res.json()) as LiveStatus | { message?: string; error?: string }
      if ((data as any)?.error) {
        throw new Error((data as any)?.error || (data as any)?.message || '启动推流失败')
      }
      setStatus(data as LiveStatus)
      toast.success('已启动推流')
    } catch (e: any) {
      toast.error(e?.message || '启动推流失败')
    } finally {
      setLoadingStart(false)
    }
  }

  const handleStop = async () => {
    setLoadingStop(true)
    try {
      const res = await fetch('/api/live/stop', { method: 'POST' })
      await ensureResponseOk(res, {
        defaultMessage: '停止推流失败',
        onUnauthorized: redirectToSignin,
      })
      const data = (await res.json()) as {
        stopped?: boolean
        status?: LiveStatus
        error?: string
      }
      if (data.error) {
        throw new Error(data.error || '停止推流失败')
      }
      if (data.status) {
        setStatus(data.status)
      } else {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                running: false,
              }
            : { running: false }
        )
      }
      toast.success('已发送停止指令')
    } catch (e: any) {
      toast.error(e?.message || '停止推流失败')
    } finally {
      setLoadingStop(false)
    }
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-2 overflow-y-auto rounded-lg border-2 p-6 shadow-lg">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Cast className="h-5 w-5" />
          Live 推流工具
        </h1>
        <p className="text-muted-foreground text-sm">
          使用后端 fluent-ffmpeg 将本地文件推流到指定 RTMP Server（例如直播平台推流地址）。
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-select">选择视频文件</Label>
            <OptionsSelect
              id="video-select"
              placeholder={
                videoOptions.length === 0
                  ? '暂无视频，请先在 Resource/Videos 中上传'
                  : '选择视频文件'
              }
              value={selectedVideo || undefined}
              items={videoOptions}
              onSelect={(item) => setSelectedVideo(item.value)}
              triggerClassName="w-full"
              contentClassName="w-72"
            />
            <p className="text-muted-foreground text-xs">
              列表来自后端 <code>workspace/videos</code> 目录，可在 Resource &gt; Videos 页面上传管理。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rtmp-server">RTMP Server</Label>
            <Input
              id="rtmp-server"
              placeholder="rtmp://example.com/live"
              value={rtmpServer}
              onChange={(e) => setRtmpServer(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stream-key">Stream Key</Label>
            <Input
              id="stream-key"
              placeholder="your-stream-key"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>合成 RTMP URL</Label>
            <Input readOnly value={rtmpUrl} className="font-mono text-xs" />
            <p className="text-muted-foreground text-xs">
              实际用于 ffmpeg 推流的地址，等于 <code>RTMP Server</code> + <code>/</code> +
              <code>Stream Key</code>。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="video-bitrate">视频码率 (kbps)</Label>
              <Input
                id="video-bitrate"
                type="number"
                min={100}
                max={5000}
                value={videoBitrate}
                onChange={(e) => setVideoBitrate(parseInt(e.target.value || '0', 10) || 800)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audio-bitrate">音频码率 (kbps)</Label>
              <Input
                id="audio-bitrate"
                type="number"
                min={32}
                max={512}
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(parseInt(e.target.value || '0', 10) || 96)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleStart}
              disabled={loadingStart || running}
              className="flex items-center gap-2"
            >
              {loadingStart ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Cast className="h-4 w-4" />
              )}
              {running ? '推流进行中' : '开始推流'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleStop}
              disabled={loadingStop || !running}
              className="flex items-center gap-2"
            >
              {loadingStop ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              停止推流
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={fetchStatus}
              disabled={loadingStatus}
            >
              {loadingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted/40 space-y-3 rounded-md border p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">当前状态</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                running
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
              )}
            >
              {running ? 'Running' : 'Idle'}
            </span>
          </div>

          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground">Input: </span>
              <span className="font-mono text-xs break-all">{status?.inputPath || '(未设置)'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">RTMP: </span>
              <span className="font-mono text-xs break-all">{status?.rtmpUrl || '(未设置)'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">PID: </span>
              <span className="font-mono text-xs">
                {status?.pid != null ? status.pid : '(未知)'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">StartedAt: </span>
              <span className="font-mono text-xs">
                {status?.startedAt ? new Date(status.startedAt).toLocaleString() : '(未启动)'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Progress: </span>
              <span className="font-mono text-xs">
                {formatTime(status?.progressSec)}
                {status?.durationSec
                  ? ` / ${formatTime(status.durationSec)}`
                  : ''}
              </span>
            </div>
          </div>

          {status?.lastError && (
            <div className="border-destructive/40 bg-destructive/5 text-destructive mt-2 rounded-md border p-2 text-xs">
              上次错误：{status.lastError}
            </div>
          )}

          <p className="text-muted-foreground mt-2 text-xs">
            注意：后端需要已安装 <code>ffmpeg</code> 与 <code>ffprobe</code> 命令行工具，且 Node
            进程能访问到对应的可执行文件（可通过环境变量 <code>FFMPEG_PATH</code> /{' '}
            <code>FFPROBE_PATH</code> 指定）。
          </p>
        </div>
      </div>
    </div>
  )
}
