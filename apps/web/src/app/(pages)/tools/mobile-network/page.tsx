'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'

type MitmStatus = {
  running: boolean
  port?: number
  dumpFile?: string
}

type DevicesResponse = {
  devices?: string
}

type FlowSummary = {
  id: string
  method: string
  url: string
  statusCode?: number
  contentType?: string
  startedAt?: string
  durationMs?: number
}

function parseDevicesText(text: string | undefined): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.toLowerCase().startsWith('list of devices'))
    .map((line) => line.split(/\s+/)[0])
}

export default function MobileNetworkPage() {
  const [mitmStatus, setMitmStatus] = useState<MitmStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [devicesRaw, setDevicesRaw] = useState<string>('')
  const [devicesLoading, setDevicesLoading] = useState(false)
  const [startPort, setStartPort] = useState<string>('8081')
  const [startDumpFile, setStartDumpFile] = useState<string>('')
  const [proxyHost, setProxyHost] = useState<string>('')
  const [proxyPort, setProxyPort] = useState<string>('8081')
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [flowsLoading, setFlowsLoading] = useState(false)
  const [flowsLimit, setFlowsLimit] = useState<string>('200')
  const [flowFilter, setFlowFilter] = useState<string>('')
  const [fridaBusy, setFridaBusy] = useState(false)
  const [fridaStatus, setFridaStatus] = useState<{
    fridaServerRunning: boolean
    fridaServerProcessLine?: string
    gettrProcessPresent: boolean
    gettrProcessLine?: string
  } | null>(null)
  const [fridaStatusLoading, setFridaStatusLoading] = useState(false)
  const [fridaLogLines, setFridaLogLines] = useState<string[]>([])
  const [fridaLogLimit, setFridaLogLimit] = useState<string>('200')
  const [fridaLogLoading, setFridaLogLoading] = useState(false)

  const deviceIds = useMemo(() => parseDevicesText(devicesRaw), [devicesRaw])

  useEffect(() => {
    // 初次加载时获取 mitm 状态和设备列表，并用当前页面 host 作为默认代理 host
    refreshStatus().catch(() => {})
    refreshDevices().catch(() => {})
    if (typeof window !== 'undefined') {
      setProxyHost(window.location.hostname || '')
    }
  }, [])

  const filteredFlows = useMemo(() => {
    const q = flowFilter.trim().toLowerCase()
    if (!q) return flows
    return flows.filter((f) => {
      const haystack = `${f.method || ''} ${f.url || ''} ${f.statusCode ?? ''} ${f.contentType || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [flows, flowFilter])

  async function refreshStatus() {
    try {
      setStatusLoading(true)
      const res = await fetch('/api/android/mitm/status', { method: 'GET', cache: 'no-store' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '获取 mitmproxy 状态失败')
      }
      const data = (await res.json()) as MitmStatus
      setMitmStatus(data)
      if (data.port && !startPort) setStartPort(String(data.port))
      if (data.port && !proxyPort) setProxyPort(String(data.port))
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取 mitmproxy 状态失败')
      }
    } finally {
      setStatusLoading(false)
    }
  }

  async function refreshDevices() {
    try {
      setDevicesLoading(true)
      const res = await fetch('/api/android/devices', { method: 'GET', cache: 'no-store' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '获取设备列表失败')
      }
      const data = (await res.json()) as DevicesResponse
      setDevicesRaw(data.devices || '')
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取设备列表失败')
      }
    } finally {
      setDevicesLoading(false)
    }
  }

  async function refreshFridaStatus() {
    try {
      setFridaStatusLoading(true)
      const res = await fetch('/api/android/frida/status', {
        method: 'GET',
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '获取 Frida 状态失败')
      }
      const data = await res.json()
      setFridaStatus({
        fridaServerRunning: !!data?.fridaServerRunning,
        fridaServerProcessLine: data?.fridaServerProcessLine || undefined,
        gettrProcessPresent: !!data?.gettrProcessPresent,
        gettrProcessLine: data?.gettrProcessLine || undefined,
      })
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取 Frida 状态失败')
      }
    } finally {
      setFridaStatusLoading(false)
    }
  }

  async function refreshFridaLog() {
    try {
      setFridaLogLoading(true)
      const n = Number(fridaLogLimit)
      const qp =
        Number.isFinite(n) && n > 0
          ? `?limit=${Math.max(1, Math.min(1000, Math.floor(n)))}`
          : ''
      const res = await fetch(`/api/android/frida/log${qp}`, {
        method: 'GET',
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '获取 Frida 日志失败')
      }
      const data = await res.json()
      setFridaLogLines(Array.isArray(data?.lines) ? data.lines : [])
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取 Frida 日志失败')
      }
    } finally {
      setFridaLogLoading(false)
    }
  }

  async function refreshFlows() {
    try {
      setFlowsLoading(true)
      const limitNum = Number(flowsLimit)
      const qp =
        Number.isFinite(limitNum) && limitNum > 0
          ? `?limit=${Math.max(1, Math.min(500, Math.floor(limitNum)))}`
          : ''
      const res = await fetch(`/api/android/mitm/flows${qp}`, {
        method: 'GET',
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '获取抓包数据失败')
      }
      const data = (await res.json()) as { flows?: FlowSummary[] }
      setFlows(Array.isArray(data.flows) ? data.flows : [])
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取抓包数据失败')
      }
    } finally {
      setFlowsLoading(false)
    }
  }

  async function handleStartMitm() {
    try {
      setBusy(true)
      const body: any = {}
      const portNum = Number(startPort)
      if (Number.isFinite(portNum) && portNum > 0) body.port = portNum
      if (startDumpFile.trim()) body.dumpFile = startDumpFile.trim()
      const res = await fetch('/api/android/mitm/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '启动 mitmproxy 失败')
      }
      const data = (await res.json()) as any
      setMitmStatus({
        running: true,
        port: data.port,
        dumpFile: data.dumpFile,
      })
      if (data.port) {
        setProxyPort(String(data.port))
      }
      const displayPort = data.port ?? (startPort || '未知')
      toast.success(`mitmproxy 已启动，端口 ${displayPort}`)
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '启动 mitmproxy 失败')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleStopMitm() {
    try {
      setBusy(true)
      const res = await fetch('/api/android/mitm/stop', { method: 'POST' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '停止 mitmproxy 失败')
      }
      const data = (await res.json()) as any
      setMitmStatus({
        running: !!data.stopped && false,
        port: data.port,
        dumpFile: data.dumpFile,
      })
      toast.success(data.stopped ? 'mitmproxy 已停止' : 'mitmproxy 未在运行')
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '停止 mitmproxy 失败')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleSetProxy() {
    if (!selectedDevice) {
      toast.error('请先选择设备')
      return
    }
    try {
      setBusy(true)
      const portNum = Number(proxyPort)
      const res = await fetch('/api/android/mitm/device-proxy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice,
          host: proxyHost.trim(),
          port: Number.isFinite(portNum) && portNum > 0 ? portNum : undefined,
        }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '设置设备代理失败')
      }
      const data = await res.json()
      toast.success(
        data.mode === 'set'
          ? `已为 ${selectedDevice} 设置代理为 ${data.host}:${data.port}`
          : `已清除 ${selectedDevice} 的代理`,
      )
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '设置设备代理失败')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleClearProxy() {
    if (!selectedDevice) {
      toast.error('请先选择设备')
      return
    }
    try {
      setBusy(true)
      const res = await fetch('/api/android/mitm/device-proxy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice,
        }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '清除设备代理失败')
      }
      const data = await res.json()
      toast.success(
        data.mode === 'clear'
          ? `已清除 ${selectedDevice} 的代理`
          : `已更新 ${selectedDevice} 的代理`,
      )
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '清除设备代理失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const running = !!mitmStatus?.running

  return (
    <div className="flex flex-col gap-2 p-4">
      <div>
        <h1 className="text-2xl font-semibold">移动端网络抓包（mitmproxy）</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          按步骤在这里启动 mitmproxy、配置 Android 设备 HTTP 代理，并在测试结束后清理。
        </p>
      </div>

      <Collapsible defaultOpen>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>步骤 1：启动 / 停止 mitmproxy</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="切换 mitmproxy 设置折叠"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="mitm-port">监听端口</Label>
                  <Input
                    id="mitm-port"
                    type="number"
                    className="w-[140px]"
                    value={startPort}
                    onChange={(e) => setStartPort(e.target.value)}
                    placeholder="8081"
                  />
                </div>
                <div className="flex-1 min-w-[220px] space-y-1">
                  <Label htmlFor="mitm-dump">流量输出文件（可选）</Label>
                  <Input
                    id="mitm-dump"
                    value={startDumpFile}
                    onChange={(e) => setStartDumpFile(e.target.value)}
                    placeholder="./tmp/mitm/flows-*.mitm（留空则使用默认路径）"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={running ? 'outline' : 'default'}
                    disabled={busy}
                    onClick={running ? handleStopMitm : handleStartMitm}
                  >
                    {running ? '停止 mitmproxy' : '启动 mitmproxy'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={statusLoading || busy}
                    onClick={refreshStatus}
                  >
                    刷新状态
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  当前状态：{' '}
                  <span className={running ? 'text-green-600' : 'text-red-600'}>
                    {running ? '运行中' : '未运行'}
                  </span>
                </div>
                <div>端口：{mitmStatus?.port ?? '未知'}</div>
                <div>最近输出文件：{mitmStatus?.dumpFile ?? '暂无'}</div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible defaultOpen>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>步骤 2：选择设备并配置 HTTP 代理</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="切换代理设置折叠"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label>设备</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedDevice}
                      onValueChange={(v) => setSelectedDevice(v)}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="选择 adb 设备 / 模拟器" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceIds.map((id) => (
                          <SelectItem key={id} value={id}>
                            {id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={devicesLoading}
                      onClick={refreshDevices}
                    >
                      刷新设备
                    </Button>
                  </div>
                  {devicesRaw && (
                    <p className="mt-1 max-w-xl whitespace-pre-wrap break-all text-xs text-muted-foreground">
                      adb devices:
                      {'\n'}
                      {devicesRaw}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="proxy-host">代理主机（本机 IP）</Label>
                  <Input
                    id="proxy-host"
                    className="w-[220px]"
                    value={proxyHost}
                    onChange={(e) => setProxyHost(e.target.value)}
                    placeholder="例如 192.168.0.10"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="proxy-port">代理端口</Label>
                  <Input
                    id="proxy-port"
                    type="number"
                    className="w-[140px]"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(e.target.value)}
                    placeholder="8081"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button disabled={busy} onClick={handleSetProxy}>
                    为设备设置代理
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={handleClearProxy}>
                    清除设备代理
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                提示：确保设备可以访问到当前 Web 后端所在机器（同一局域网），
                且已在设备上安装 mitmproxy CA 证书，否则 HTTPS 抓包可能失败。
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader>
          <CardTitle>使用步骤小结</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>1. 确认本机已安装 mitmproxy（命令行可执行 mitmdump）。</p>
          <p>2. 在上方「步骤 1」中启动 mitmproxy，记住端口与输出文件路径。</p>
          <p>3. 在「步骤 2」中选择 adb 设备，设置 HTTP 代理为当前主机 IP + mitmproxy 端口。</p>
          <p>4. 运行移动端自动化用例，所有网络请求会被 mitmproxy 记录到输出文件。</p>
          <p>5. 测试结束后，清除设备代理，并在「步骤 1」停止 mitmproxy。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>步骤 3：查看抓包网络请求</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="flows-limit">最多加载条数</Label>
              <Input
                id="flows-limit"
                type="number"
                className="w-[120px]"
                value={flowsLimit}
                onChange={(e) => setFlowsLimit(e.target.value)}
                placeholder="200"
              />
            </div>
            <div className="flex-1 min-w-[220px] space-y-1">
              <Label htmlFor="flow-filter">过滤（方法 / URL / 状态码 / 类型）</Label>
              <Input
                id="flow-filter"
                value={flowFilter}
                onChange={(e) => setFlowFilter(e.target.value)}
                placeholder="例如 GET /api 或 500 application/json"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button disabled={flowsLoading} onClick={refreshFlows}>
                {flowsLoading ? '加载中…' : '刷新抓包列表'}
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Method</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="w-[160px]">Start</TableHead>
                <TableHead className="w-[80px]">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.method || ''}</TableCell>
                  <TableCell>{f.statusCode ?? ''}</TableCell>
                  <TableCell className="max-w-[520px] truncate" title={f.url}>
                    {f.url}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={f.contentType}>
                    {f.contentType ?? ''}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {f.startedAt
                      ? new Date(f.startedAt).toLocaleTimeString()
                      : ''}
                  </TableCell>
                  <TableCell className="text-xs">
                    {typeof f.durationMs === 'number' ? `${f.durationMs} ms` : ''}
                  </TableCell>
                </TableRow>
              ))}
              {!flowsLoading && filteredFlows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-2">
                    暂无抓包数据，请先启动 mitmproxy，配置设备代理并触发网络请求后刷新列表。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>步骤 4：Frida SSL Pinning Bypass（GETTR）</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="切换 Frida 设置折叠"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                仅适用于 Android 模拟器上的 GETTR（com.gettr.gettr）。需要预先将 frida-server
                推到设备的 <code>/data/local/tmp/frida-server</code>，并在本机安装
                <code>frida</code> 命令行工具。
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  disabled={fridaBusy}
                  onClick={async () => {
                    try {
                      setFridaBusy(true)
                      const res = await fetch('/api/android/frida/start-server', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({}),
                      })
                      if (!res.ok) {
                        const err = await normalizeResponseError(res)
                        throw new Error(err.message || '启动 frida-server 失败')
                      }
                      const data = await res.json()
                      toast.success(data?.message || 'frida-server 启动命令已下发')
                    } catch (e: any) {
                      toast.error(e?.message || '启动 frida-server 失败')
                    } finally {
                      setFridaBusy(false)
                    }
                  }}
                >
                  启动 frida-server（设备）
                </Button>
                <Button
                  disabled={fridaBusy}
                  onClick={async () => {
                    try {
                      setFridaBusy(true)
                      const res = await fetch(
                        '/api/android/frida/start-gettr-bypass',
                        {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({}),
                        },
                      )
                      if (!res.ok) {
                        const err = await normalizeResponseError(res)
                        throw new Error(
                          err.message || '启动 GETTR SSL Bypass 失败',
                        )
                      }
                      const data = await res.json()
                      toast.success(
                        data?.message ||
                          '已尝试为 GETTR 注入 Frida SSL Bypass（请确保 App 正在运行）',
                      )
                    } catch (e: any) {
                      toast.error(e?.message || '启动 GETTR SSL Bypass 失败')
                    } finally {
                      setFridaBusy(false)
                    }
                  }}
                >
                  注入 GETTR SSL Bypass
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={fridaStatusLoading}
                  onClick={refreshFridaStatus}
                >
                  {fridaStatusLoading ? '刷新中…' : '刷新 Frida 状态'}
                </Button>
                <div>
                  frida-server:{' '}
                  <span className={fridaStatus?.fridaServerRunning ? 'text-green-600' : 'text-red-600'}>
                    {fridaStatus?.fridaServerRunning ? '运行中' : '未检测到'}
                  </span>
                </div>
                <div>
                  GETTR 进程:{' '}
                  <span className={fridaStatus?.gettrProcessPresent ? 'text-green-600' : 'text-red-600'}>
                    {fridaStatus?.gettrProcessPresent ? '已检测到' : '未检测到'}
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="frida-log-limit">Frida 日志行数</Label>
                    <Input
                      id="frida-log-limit"
                      type="number"
                      className="w-[120px]"
                      value={fridaLogLimit}
                      onChange={(e) => setFridaLogLimit(e.target.value)}
                      placeholder="200"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={fridaLogLoading}
                    onClick={refreshFridaLog}
                  >
                    {fridaLogLoading ? '加载日志中…' : '刷新 Frida 日志'}
                  </Button>
                </div>
                <div className="max-h-56 w-full overflow-auto rounded border bg-muted text-xs font-mono p-2 whitespace-pre-wrap">
                  {fridaLogLines.length === 0 && !fridaLogLoading ? (
                    <span className="text-muted-foreground">
                      暂无 Frida 日志内容，请先尝试启动 frida-server 并注入 GETTR Bypass 后刷新。
                    </span>
                  ) : (
                    fridaLogLines.join('\n')
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                提示：此操作通过后端调用 <code>frida</code> 命令行和 frida-server，属于最佳努力，遇到版本或架构不匹配时，请先在本机手动验证
                <code>frida-ps -U</code>、<code>frida -U -n GETTR</code> 是否正常。
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
