'use client'

import { useEffect, useMemo, useState } from 'react'
import { Code2, Loader2, Play, Plus, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useSession } from '@/app/context/session-context'
import { toast } from 'sonner'
import { OptionsSelectInput } from '@/components/select/options-select-input'
import { useCurlRunner, type CurlRunnerConfig } from '@/hooks/use-curl-runner'
import { useStore } from '@/hooks/use-store'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

type CurlPayloadRecord = {
  method: HttpMethod
  category: string
  url: string
  headers: string
  payload: string
}

type SavedPayloadsResponse = {
  items: CurlPayloadRecord[]
}

type ExecuteResult = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}

const METHOD_OPTIONS: HttpMethod[] = ['POST', 'GET', 'DELETE']
const CATEGORY_OPTIONS = ['SMSLimt']

function makeKey(method: HttpMethod, category: string, url: string) {
  const normalizedUrl = (url || '').trim()
  return `${method}::${category}::${normalizedUrl}`
}

export default function CurlCommandToolPage() {
  const { isAuthenticated } = useSession()
  const runner = useStore(useCurlRunner, (s) => s)
  const isRunning = runner?.isRunning ?? false
  const execResult = runner?.result ?? null
  const runnerError = runner?.error ?? null
  const runStats =
    runner?.runStats ??
    ({
      total: 0,
      statuses: [],
    } as { total: number; statuses: number[] })
  const start = runner?.start
  const stop = runner?.stop
  const config = runner?.config ?? null

  const [method, setMethod] = useState<HttpMethod>('POST')
  const [category, setCategory] = useState<string>('SMSLimt')
  const [url, setUrl] = useState<string>('')
  const [headers, setHeaders] = useState<string>('')
  const [payload, setPayload] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [repeatCount, setRepeatCount] = useState<number>(1)
  const [repeatIntervalMs, setRepeatIntervalMs] = useState(61000)

  const [savedMap, setSavedMap] = useState<Record<string, CurlPayloadRecord>>({})

  const currentKey = useMemo(() => makeKey(method, category, url), [method, category, url])

  const urlOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = []
    const seen = new Set<string>()
    for (const item of Object.values(savedMap)) {
      if (!item?.url) continue
      if (item.method !== method || item.category !== category) continue
      const normalizedUrl = (item.url || '').trim()
      if (!normalizedUrl || seen.has(normalizedUrl)) continue
      seen.add(normalizedUrl)
      opts.push({ label: normalizedUrl, value: normalizedUrl })
    }
    return opts
  }, [savedMap, method, category])

  const categoryOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = []
    const seen = new Set<string>()

    // 默认 Category
    for (const c of CATEGORY_OPTIONS) {
      const trimmed = (c || '').trim()
      if (!trimmed || seen.has(trimmed)) continue
      seen.add(trimmed)
      opts.push({ label: trimmed, value: trimmed })
    }

    // 从已保存记录中提取当前 method 下的所有 category
    for (const item of Object.values(savedMap)) {
      if (!item?.category) continue
      if (item.method !== method) continue
      const trimmed = (item.category || '').trim()
      if (!trimmed || seen.has(trimmed)) continue
      seen.add(trimmed)
      opts.push({ label: trimmed, value: trimmed })
    }

    return opts
  }, [savedMap, method])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/settings/curl-payloads', {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error(res.statusText || 'Failed to load saved payloads')
        }
        const data = (await res.json()) as SavedPayloadsResponse
        if (cancelled) return
        const map: Record<string, CurlPayloadRecord> = {}
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            if (!item?.method || !item?.category) continue
            const key = makeKey(item.method as HttpMethod, item.category, item.url)
            map[key] = item
          }
        }
        setSavedMap(map)
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load saved payloads')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  // 如果有正在运行的全局任务，回到页面时同步表单配置
  useEffect(() => {
    if (config) {
      setMethod(config.method)
      setCategory(config.category)
      setUrl(config.url)
      setHeaders(config.headers)
      setPayload(config.payload)
      setRepeatCount(config.repeatCount)
      setRepeatIntervalMs(config.repeatIntervalMs)
    }
  }, [config])

  useEffect(() => {
    const record = savedMap[currentKey]
    if (record) {
      setUrl(record.url || '')
      setHeaders(record.headers || '')
      setPayload(record.payload || '')
    }
  }, [currentKey, savedMap])

  const saveCurrentConfig = async (showToast: boolean) => {
    const body: CurlPayloadRecord = {
      method,
      category,
      url: url.trim(),
      headers,
      payload,
    }
    const res = await fetch('/api/settings/curl-payloads', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(msg || 'Failed to save payload')
    }
    const saved = (await res.json()) as CurlPayloadRecord
    setSavedMap((prev) => ({
      ...prev,
      [makeKey(saved.method, saved.category, saved.url)]: saved,
    }))
    if (showToast) {
      toast.success('保存成功')
    }
    return saved
  }

  const handleAdd = async () => {
    if (!isAuthenticated) {
      setError('请先登录')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveCurrentConfig(true)
    } catch (e: any) {
      setError(e?.message || '保存失败')
      toast.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateCurl = () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('请先填写 API URL')
      toast.error('请先填写 API URL')
      return
    }
    // 构建 curl 命令
    const lines: string[] = []
    const methodUpper = method.toUpperCase()
    lines.push(`curl -X ${methodUpper} \\`)
    lines.push(`  '${trimmedUrl}' \\`)

    // 解析 headers（JSON 对象），构造 -H 行
    const headersText = headers.trim()
    if (headersText) {
      try {
        const parsed = JSON.parse(headersText)
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof k === 'string' && typeof v === 'string') {
              lines.push(`  -H '${k}: ${v}' \\`)
            }
          }
        }
      } catch {
        // 如果 headers 不是合法 JSON，就直接按原文本拼到注释里，避免抛错
        lines.push(`  # headers (invalid JSON, please fix in UI)`)
      }
    }

    const payloadText = payload.trim()
    if (payloadText) {
      const escapedPayload = payloadText.replace(/'/g, "\\'")
      lines.push(`  --data-raw '${escapedPayload}'`)
    } else {
      // 去掉最后一行多余的反斜杠
      const lastIdx = lines.length - 1
      if (lastIdx >= 0 && lines[lastIdx].endsWith(' \\')) {
        lines[lastIdx] = lines[lastIdx].slice(0, -2)
      }
    }

    const curlBody = lines.join('\n')
    // 将生成的 curl 命令展示在 Result 区域（使用全局 runner）
    useCurlRunner.setState((prev) => ({
      ...prev,
      result: {
        ok: true,
        status: 0,
        statusText: 'curl',
        headers: {},
        body: curlBody,
      },
      error: null,
    }))
    setError(null)
  }

  const handleExecute = async () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('请先填写 API URL')
      return
    }

    // 自动保存当前配置（如果尚未保存或已修改）
    const existing = savedMap[currentKey]
    const needsSave = !existing || existing.headers !== headers || existing.payload !== payload
    if (needsSave) {
      try {
        await saveCurrentConfig(false)
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg || '自动保存失败')
        toast.error(msg || '自动保存失败')
        return
      }
    }

    // 如果当前处于高级模式且正在运行，点击视为 Stop
    if (advancedOpen && isRunning) {
      stop?.()
      return
    }

    const cfg: CurlRunnerConfig = {
      method,
      category,
      url: trimmedUrl,
      headers,
      payload,
      repeatCount,
      repeatIntervalMs,
    }

    setError(null)
    start?.(cfg)
  }

  const handleShowLastStatus = () => {
    if (!runStats.total) {
      window.alert('尚无执行记录')
      return
    }
    const lines: string[] = []
    lines.push(`执行次数: ${runStats.total}`)
    runStats.statuses.forEach((status, idx) => {
      lines.push(`第 ${idx + 1} 次: HTTP ${status}`)
    })
    window.alert(lines.join('\n'))
  }

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border p-4 max-w-full overflow-x-hidden">
      <div>
        <h1 className="mb-2 flex items-center gap-2 text-xl font-semibold">
          CurlCmd
          {isRunning && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              RUNNING
            </span>
          )}
        </h1>
        <p className="text-muted-foreground text-sm">
          组合 Method + Category 作为 key，保存并复用对应的请求 URL 与 Payload。
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
            <SelectTrigger className="h-9 min-w-[100px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              {METHOD_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <OptionsSelectInput
            id="curl-url"
            value={url}
            onChange={setUrl}
            items={urlOptions}
            placeholder="api url"
            className="min-w-[220px] flex-1"
          />

          <OptionsSelectInput
            id="curl-category"
            value={category}
            onChange={setCategory}
            items={categoryOptions}
            placeholder="Category"
            className="min-w-[140px]"
          />

          <div className="ml-2 flex items-center gap-2">
            <Button
              type="button"
              variant={advancedOpen ? 'default' : 'outline'}
              size="icon"
              className="shrink-0"
              onClick={() => setAdvancedOpen((v) => !v)}
              title={advancedOpen ? 'Hide Advanced' : 'Advanced'}
              aria-label="Advanced settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            {advancedOpen && (
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <span>Repeat</span>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={repeatCount}
                  onChange={(e) =>
                    setRepeatCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))
                  }
                  className="h-8 w-20 text-xs"
                />
                <span>times</span>
                <span>Interval</span>
                <Input
                  type="number"
                  min={500}
                  max={600000}
                  value={repeatIntervalMs}
                  onChange={(e) =>
                    setRepeatIntervalMs(
                      Math.max(500, Math.min(600000, Number(e.target.value) || 0))
                    )
                  }
                  className="h-8 w-24 text-xs"
                />
                <span>ms</span>
              </div>
            )}
          </div>

          <Button
            type="button"
            size="default"
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleShowLastStatus}
            disabled={runStats.total === 0}
          >
            LastStatus
          </Button>

          <Button
            type="button"
            size="default"
            className="ml-auto flex w-[80px] items-center justify-center gap-2"
            onClick={handleExecute}
            disabled={loading}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="inline-block w-[40px] text-center text-xs">
              {advancedOpen && isRunning
                ? 'Stop'
                : !advancedOpen && isRunning
                  ? 'Running'
                  : 'Start'}
            </span>
          </Button>
        </div>

        <div className="w-full">
          <div className="flex w-full min-w-0 flex-row gap-2">
            <div className="flex max-w-[50%] min-w-0 basis-1/2 flex-col gap-2">
              <Label className="text-muted-foreground text-xs">Headers</Label>
              <div className="w-full overflow-x-auto">
                <Textarea
                  className="h-60 w-full max-w-full min-w-0 resize-y overflow-x-auto font-mono text-xs whitespace-pre"
                  style={{
                    boxSizing: 'border-box',
                    overflowWrap: 'normal',
                    wordBreak: 'normal',
                  }}
                  placeholder='Request headers, JSON object，例如：{"Authorization":"Bearer xxx"}'
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                />
              </div>
            </div>
            <div className="flex max-w-[50%] min-w-0 basis-1/2 flex-col gap-2">
              <Label className="text-muted-foreground text-xs">Payload</Label>
              <div className="w-full overflow-x-auto">
                <Textarea
                  className="h-60 w-full max-w-full min-w-0 resize-y overflow-x-auto font-mono text-xs whitespace-pre"
                  style={{
                    boxSizing: 'border-box',
                    overflowWrap: 'normal',
                    wordBreak: 'normal',
                  }}
                  placeholder="Request payload (JSON / body)"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleAdd}
            disabled={saving || loading}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleGenerateCurl}
            disabled={loading}
          >
            <Code2 className="h-4 w-4" />
            Curl
          </Button>
          {currentKey && (
            <span className="text-muted-foreground text-xs">
              Key: <code className={cn('font-mono')}>{currentKey}</code>
            </span>
          )}
        </div>
      </div>

      <div className="w-full space-y-2">
        <div className="text-sm font-medium">Result</div>
        {execResult ? (
          <>
            <div className="text-muted-foreground text-xs">
              <span
                className={cn('font-mono', execResult.ok ? 'text-emerald-600' : 'text-destructive')}
              >
                HTTP {execResult.status} {execResult.statusText}{' '}
                {execResult.ok ? '(OK)' : '(Failed)'}
              </span>
            </div>
            {Object.keys(execResult.headers).length > 0 && (
              <div className="space-y-1 text-xs max-w-full overflow-x-auto">
                <div className="font-medium">Headers</div>
                <pre className="bg-muted max-h-40 w-full max-w-full overflow-auto rounded-md border px-3 py-2 text-[11px]">
                  {Object.entries(execResult.headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')}
                </pre>
              </div>
            )}
            <div className="space-y-1 text-xs max-w-full overflow-x-auto">
              <div className="font-medium">Body</div>
              <pre className="bg-muted max-h-80 w-full max-w-full overflow-auto rounded-md border px-3 py-2 text-[11px]">
                {(() => {
                  const raw = execResult.body || ''
                  const trimmed = raw.trim()
                  if (
                    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                    (trimmed.startsWith('[') && trimmed.endsWith(']'))
                  ) {
                    try {
                      const parsed = JSON.parse(trimmed)
                      return JSON.stringify(parsed, null, 2)
                    } catch {
                      // fall through
                    }
                  }
                  return raw
                })()}
              </pre>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-xs">Result will be displayed here</p>
        )}
      </div>
    </div>
  )
}
