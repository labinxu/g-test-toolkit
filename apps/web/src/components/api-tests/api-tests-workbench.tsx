'use client'

import { useEffect, useMemo, useState } from 'react'
import { Play, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Save } from 'lucide-react'
import { toast } from 'sonner'

import { useSession } from '@/app/context/session-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { OptionsSelectInput } from '@/components/select/options-select-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

type ParamLocation = 'path' | 'query' | 'header' | 'body'

type ParamBoundaryCase = {
  id: string
  label: string
  kind: string
  value: unknown
  description?: string
  enabled: boolean
}

type ApiParamConfig = {
  name: string
  location: ParamLocation
  type: 'string' | 'number' | 'boolean' | 'json'
  required: boolean
  description?: string
  defaultValue?: unknown
  boundaryCases: ParamBoundaryCase[]
}

type ApiEndpoint = {
  id: string
  category: string
  name: string
  method: HttpMethod
  path: string
  description?: string
  tags?: string[]
  params: ApiParamConfig[]
}

type ExecutionMode = 'single' | 'batch' | 'sequence'

type ApiTestCaseResult = {
  id: string
  title: string
  ok: boolean
  status: number
  durationMs: number
  error?: string
  request: {
    method: HttpMethod
    url: string
    headers: Record<string, string>
    bodyPreview?: string | null
  }
  response: {
    status: number
    headers: Record<string, string>
    bodyText: string
    truncated: boolean
  }
}

type SchemaResponse = {
  endpoints: ApiEndpoint[]
}

type RunResponse = {
  endpointId: string
  baseUrl: string
  mode: ExecutionMode
  results: ApiTestCaseResult[]
}

type EndpointConfig = {
  baseUrl?: string
  headers?: Record<string, string>
}

type ModuleMappingResponse = {
  byEndpoint: Record<string, EndpointConfig>
  baseUrlOptions?: string[]
}

type ApiTestsSettings = {
  baseUrl: string
  defaultHeaders: Record<string, string>
  sampleLivePostId: string
}

const METHOD_FILTER_OPTIONS: Array<'ALL' | HttpMethod> = [
  'ALL',
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
]

function groupByCategory(endpoints: ApiEndpoint[]) {
  const map = new Map<string, ApiEndpoint[]>()
  for (const ep of endpoints) {
    const key = ep.category || 'General'
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(ep)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.path.localeCompare(b.path))
  }
  return Array.from(map.entries())
    .map(([category, list]) => ({ category, endpoints: list }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

function stringifyDefault(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function headersToText(headers: Record<string, string> | null | undefined): string {
  if (!headers || Object.keys(headers).length === 0) return ''
  return JSON.stringify(headers, null, 2)
}

function parseHeaders(text: string): Record<string, string> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Headers must be a JSON object')
    }
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== 'string') continue
      if (typeof v === 'string') {
        out[k] = v
      } else {
        try {
          out[k] = JSON.stringify(v)
        } catch {
          // ignore
        }
      }
    }
    return out
  } catch (e: any) {
    throw new Error(e?.message || 'Invalid headers JSON')
  }
}

export type ApiTestsWorkbenchProps = {
  moduleId: string // e.g. 'corebe', 'notif'
  schemaApiPath: string // e.g. '/api/api-tests/core-be/schema'
  runApiPath: string // e.g. '/api/api-tests/core-be/run'
  title: string
  description: string
}

export function ApiTestsWorkbench({
  moduleId,
  schemaApiPath,
  runApiPath,
  title,
  description,
}: ApiTestsWorkbenchProps) {
  const { isAuthenticated, csrfToken } = useSession()

  const [schema, setSchema] = useState<SchemaResponse | null>(null)
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const [defaultBaseUrl, setDefaultBaseUrl] = useState('')
  const [defaultHeaders, setDefaultHeaders] = useState<Record<string, string>>({})
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [endpointConfigs, setEndpointConfigs] = useState<Record<string, EndpointConfig>>({})
  const [baseUrlOptions, setBaseUrlOptions] = useState<string[]>([])

  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [boundaryEnabled, setBoundaryEnabled] = useState<Record<string, boolean>>({})

  const [baseUrlInput, setBaseUrlInput] = useState('')
  const [headersText, setHeadersText] = useState('')
  const [configDirty, setConfigDirty] = useState(false)

  const [runningMode, setRunningMode] = useState<ExecutionMode | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<RunResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const [filterText, setFilterText] = useState('')
  const [categoryCollapsed, setCategoryCollapsed] = useState<Record<string, boolean>>({})
  const [methodFilter, setMethodFilter] = useState<'ALL' | HttpMethod>('ALL')
  const [tagFilter, setTagFilter] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false

    const loadDefaults = async () => {
      try {
        const res = await fetch('/api/settings/api-tests', {
          cache: 'no-store',
        })
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText)
          throw new Error(text || 'Failed to load API tests settings')
        }
        const data = (await res.json()) as ApiTestsSettings
        if (cancelled) return
        setDefaultBaseUrl(typeof data?.baseUrl === 'string' ? data.baseUrl : '')
        setDefaultHeaders(
          data?.defaultHeaders && typeof data.defaultHeaders === 'object' ? data.defaultHeaders : {}
        )
        setSettingsError(null)
      } catch (e: any) {
        if (cancelled) return
        setSettingsError(e?.message || 'Failed to load API tests settings')
        toast.error(e?.message || 'Failed to load API tests settings')
      }
    }

    const loadSchema = async () => {
      try {
        const res = await fetch(schemaApiPath, { cache: 'no-store' })
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText)
          throw new Error(text || 'Failed to load API schema')
        }
        const data = (await res.json()) as SchemaResponse
        if (cancelled) return
        setSchema(data)
        setSchemaError(null)
        if (!selectedEndpointId && data.endpoints.length > 0) {
          setSelectedEndpointId(data.endpoints[0].id)
        }
      } catch (e: any) {
        if (cancelled) return
        setSchemaError(e?.message || 'Failed to load API schema')
        toast.error(e?.message || 'Failed to load API schema')
      }
    }

    const loadModuleMapping = async () => {
      try {
        const res = await fetch(
          `/api/settings/api-tests/module-mapping/${encodeURIComponent(moduleId)}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const data = (await res.json()) as ModuleMappingResponse
        if (cancelled) return
        setEndpointConfigs(data.byEndpoint || {})
        const setOpts = new Set<string>()
        ;(data.baseUrlOptions || []).forEach((url) => {
          if (url && typeof url === 'string') setOpts.add(url)
        })
        if (defaultBaseUrl) setOpts.add(defaultBaseUrl)
        setBaseUrlOptions(Array.from(setOpts))
      } catch {
        // ignore mapping load errors
      }
    }

    void loadDefaults()
    void loadSchema()
    void loadModuleMapping()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, schemaApiPath, moduleId, selectedEndpointId, defaultBaseUrl])

  const endpoints = schema?.endpoints ?? []
  const grouped = useMemo(() => groupByCategory(endpoints), [endpoints])

  const filteredGrouped = useMemo(() => {
    const keyword = filterText.trim().toLowerCase()
    const method = methodFilter
    const tagKw = tagFilter.trim().toLowerCase()

    return grouped
      .map((group) => {
        const eps = group.endpoints.filter((ep) => {
          if (method !== 'ALL' && ep.method !== method) return false

          if (tagKw) {
            const tags = ep.tags || []
            const hit = tags.length > 0 && tags.some((t) => t.toLowerCase().includes(tagKw))
            if (!hit) return false
          }

          if (keyword) {
            const haystack = [group.category, ep.name, ep.path, ep.method, ...(ep.tags || [])]
              .join(' ')
              .toLowerCase()
            if (!haystack.includes(keyword)) return false
          }

          return true
        })
        return { ...group, endpoints: eps }
      })
      .filter((g) => g.endpoints.length > 0)
  }, [grouped, filterText, methodFilter, tagFilter])

  const selectedEndpoint: ApiEndpoint | null = useMemo(() => {
    if (!endpoints.length) return null
    if (selectedEndpointId) {
      const found = endpoints.find((e) => e.id === selectedEndpointId)
      if (found) return found
    }
    return endpoints[0] ?? null
  }, [endpoints, selectedEndpointId])

  useEffect(() => {
    if (!selectedEndpoint) return
    const cfg = endpointConfigs[selectedEndpoint.id] || {}
    const base = cfg.baseUrl || defaultBaseUrl
    const hdrs = cfg.headers || defaultHeaders
    setBaseUrlInput(base || '')
    setHeadersText(headersToText(hdrs))
    setConfigDirty(false)
  }, [selectedEndpoint, endpointConfigs, defaultBaseUrl, defaultHeaders])

  useEffect(() => {
    if (!selectedEndpoint) return
    const nextValues: Record<string, string> = {}
    const nextBoundary: Record<string, boolean> = {}
    for (const p of selectedEndpoint.params || []) {
      nextValues[p.name] = stringifyDefault(p.defaultValue)
      for (const b of p.boundaryCases || []) {
        nextBoundary[b.id] = b.enabled !== false
      }
    }
    setParamValues(nextValues)
    setBoundaryEnabled(nextBoundary)
  }, [selectedEndpoint])

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleToggleBoundary = (id: string) => {
    setBoundaryEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleBaseUrlChange = (value: string) => {
    setBaseUrlInput(value)
    setConfigDirty(true)
  }

  const handleHeadersChange = (value: string) => {
    setHeadersText(value)
    setConfigDirty(true)
  }

  const handleSaveConfig = async () => {
    if (!selectedEndpoint) return
    let headersObj: Record<string, string> | null = null
    try {
      headersObj = parseHeaders(headersText)
    } catch (e: any) {
      toast.error(e?.message || 'Headers JSON 无效')
      return
    }
    const base = baseUrlInput.trim()
    const payload = {
      baseUrl: base || undefined,
      headers: headersObj,
    }
    try {
      const headers: HeadersInit = { 'content-type': 'application/json' }
      if (csrfToken) {
        ;(headers as any)['x-csrf-token'] = csrfToken
      }
      const res = await fetch(
        `/api/settings/api-tests/module-mapping/${encodeURIComponent(
          moduleId
        )}/${encodeURIComponent(selectedEndpoint.id)}`,
        {
          method: 'PUT',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(text || '保存失败')
      }
      setEndpointConfigs((prev) => ({
        ...prev,
        [selectedEndpoint.id]: {
          baseUrl: base || undefined,
          headers: headersObj || undefined,
        },
      }))
      setBaseUrlOptions((prev) => {
        const set = new Set(prev)
        if (base) set.add(base)
        if (defaultBaseUrl) set.add(defaultBaseUrl)
        return Array.from(set)
      })
      setConfigDirty(false)
      toast.success('已保存当前接口配置')
    } catch (e: any) {
      toast.error(e?.message || '保存失败')
    }
  }

  const buildBaseParams = () => {
    const base: Record<string, unknown> = {}
    if (!selectedEndpoint) return base
    for (const p of selectedEndpoint.params || []) {
      const raw = paramValues[p.name] ?? ''
      if (!raw && p.defaultValue === undefined) continue
      let value: unknown = raw
      if (p.type === 'number') {
        const n = Number(raw)
        if (Number.isFinite(n)) value = n
      } else if (p.type === 'boolean') {
        const lowered = raw.toLowerCase()
        value = lowered === 'true' || lowered === '1'
      } else if (p.type === 'json') {
        if (raw.trim()) {
          try {
            value = JSON.parse(raw)
          } catch {
            value = raw
          }
        } else {
          value = undefined
        }
      }
      if (value !== undefined) {
        base[p.name] = value
      }
    }
    return base
  }

  const buildBoundaryCases = () => {
    if (!selectedEndpoint) return []
    const base = buildBaseParams()
    const cases: {
      id: string
      title: string
      paramsOverride: Record<string, unknown>
    }[] = []

    for (const p of selectedEndpoint.params || []) {
      for (const b of p.boundaryCases || []) {
        if (!boundaryEnabled[b.id]) continue
        const params = { ...base, [p.name]: b.value }
        cases.push({
          id: b.id,
          title: `${p.name} -> ${b.label}`,
          paramsOverride: params,
        })
      }
    }
    return cases
  }

  const effectiveBaseUrl = useMemo(() => {
    if (!selectedEndpoint) return baseUrlInput.trim() || defaultBaseUrl.trim()
    const cfg = endpointConfigs[selectedEndpoint.id] || {}
    return (cfg.baseUrl || baseUrlInput || defaultBaseUrl).trim()
  }, [baseUrlInput, defaultBaseUrl, endpointConfigs, selectedEndpoint])

  const effectiveHeaders = useMemo(() => {
    if (!selectedEndpoint) return defaultHeaders
    const cfg = endpointConfigs[selectedEndpoint.id] || {}
    return cfg.headers || defaultHeaders
  }, [endpointConfigs, selectedEndpoint, defaultHeaders])

  const run = async (mode: ExecutionMode) => {
    if (!selectedEndpoint) {
      toast.error('没有可用的接口定义')
      return
    }
    if (!isAuthenticated) {
      toast.error('请先登录')
      return
    }

    // headersText 中可能包含对 effectiveHeaders 的最新编辑
    let headersOverride: Record<string, string> | null = null
    try {
      headersOverride = parseHeaders(headersText)
    } catch (e: any) {
      toast.error(e?.message || 'Headers JSON 无效')
      return
    }

    let cases: {
      id: string
      title: string
      paramsOverride: Record<string, unknown>
    }[] = []

    if (mode === 'single') {
      const params = buildBaseParams()
      cases = [
        {
          id: 'single',
          title: 'Single run',
          paramsOverride: params,
        },
      ]
    } else {
      cases = buildBoundaryCases()
      if (!cases.length) {
        toast.error('请先勾选至少一个边界值')
        return
      }
    }

    const base = effectiveBaseUrl.trim()
    if (!base) {
      toast.error('Base URL 不能为空（请在 Parameters 页面或当前接口中设置）')
      return
    }

    setRunningMode(mode)
    setRunError(null)
    setRunResult(null)
    setLoading(true)
    try {
      const payload = {
        endpointId: selectedEndpoint.id,
        mode,
        baseUrlOverride: base || undefined,
        headersOverride: headersOverride || effectiveHeaders || undefined,
        cases,
      }
      const headers: HeadersInit = {
        'content-type': 'application/json',
      }
      if (csrfToken) {
        ;(headers as any)['x-csrf-token'] = csrfToken
      }
      const res = await fetch(runApiPath, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(text || 'Run failed')
      }
      const data = (await res.json()) as RunResponse
      setRunResult(data)
    } catch (e: any) {
      const msg = e?.message || 'Run failed'
      setRunError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
      setRunningMode(null)
    }
  }

  const hasData = endpoints.length > 0

  return (
    <div className="flex flex-1 gap-4 rounded-lg">
      <aside className="w-64 shrink-0 space-y-3">
        <div className="bg-card rounded-xl border px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm leading-6 font-semibold">API 回归 · {moduleId}</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                左侧选择接口，右侧配置参数与边界值执行。
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="border-b px-3 py-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              接口分类
            </h3>
          </div>
          <div className="space-y-2 px-3 pt-2 pb-1">
            <Input
              id="api-filter"
              placeholder="按路径/说明过滤"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 w-full text-xs"
            />
            <div className="flex items-center gap-2">
              <Select
                value={methodFilter}
                onValueChange={(v) => setMethodFilter(v as 'ALL' | HttpMethod)}
              >
                <SelectTrigger className="h-8 min-w-[90px] text-xs">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_FILTER_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="api-tag-filter"
                placeholder="按标签过滤 (例如 live)"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="h-8 flex-1 text-xs"
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-260px)] space-y-1 overflow-auto px-2 pb-2 text-sm">
            {!hasData && (
              <div className="text-muted-foreground px-2 py-1 text-xs">
                暂无接口定义，请稍后重试。
              </div>
            )}
            {filteredGrouped.map((group) => {
              const collapsed = !!categoryCollapsed[group.category]
              return (
                <div key={group.category} className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryCollapsed((prev) => ({
                        ...prev,
                        [group.category]: !prev[group.category],
                      }))
                    }
                    className="text-muted-foreground hover:bg-muted flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium"
                  >
                    <span>{group.category}</span>
                    {collapsed ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {!collapsed &&
                    group.endpoints.map((ep) => {
                      const active =
                        (
                          schema?.endpoints.find((e) => e.id === selectedEndpointId) ??
                          schema?.endpoints[0]
                        )?.id === ep.id
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => setSelectedEndpointId(ep.id)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs',
                            active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          )}
                        >
                          <span className="truncate">
                            <span className="mr-1 rounded border px-1 py-0.5 font-mono text-[10px] uppercase">
                              {ep.method}
                            </span>
                            <span className="font-mono">{ep.path}</span>
                          </span>
                        </button>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-4">
        <section className="bg-card rounded-xl border p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base leading-6 font-semibold">{title}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg">
            <Collapsible className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-muted flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium"
                >
                  <span>接口配置（Base URL &amp; Headers）</span>
                  <span className="text-[11px]">
                    {effectiveBaseUrl || defaultBaseUrl || '未配置 Base URL'}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden border-t px-3 py-3">
                <div className="grid items-end gap-4 md:grid-cols-[2.4fr,3fr]">
                  <div className="space-y-2">
                    <Label htmlFor="api-base-url">Base URL</Label>
                    <div className="flex items-center gap-2">
                      <OptionsSelectInput
                        id="api-base-url"
                        placeholder={defaultBaseUrl || 'https://example.com'}
                        value={baseUrlInput}
                        onChange={handleBaseUrlChange}
                        items={[
                          ...baseUrlOptions.map((url) => ({
                            value: url,
                            label: url,
                          })),
                        ]}
                        className="w-full"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="flex items-center gap-1"
                        disabled={!configDirty}
                        onClick={handleSaveConfig}
                      >
                        <Save className="h-3.5 w-3.5" />
                        保存
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api-headers-json">Headers JSON（当前接口）</Label>
                    <Textarea
                      id="api-headers-json"
                      className="font-mono text-xs"
                      rows={4}
                      value={headersText}
                      onChange={(e) => handleHeadersChange(e.target.value)}
                      placeholder={headersToText(defaultHeaders)}
                    />
                    <p className="text-muted-foreground text-xs">
                      JSON 对象，优先用于当前接口；为空时退回到 Parameters 页的默认 Headers。
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {(settingsError || schemaError) && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div className="font-medium">配置加载异常</div>
                <div className="mt-0.5">{settingsError || schemaError || 'Unknown error'}</div>
              </div>
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-1 gap-4">
          <div className="bg-card flex min-w-0 flex-1 flex-col gap-3 overflow-auto rounded-xl border p-4 shadow-sm">
            <h2 className="text-sm font-semibold">接口与参数</h2>
            {!selectedEndpoint && (
              <p className="text-muted-foreground text-xs">暂无可用接口定义。</p>
            )}
            {selectedEndpoint && (
              <>
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase">
                      {selectedEndpoint.method}
                    </span>
                    <span className="font-mono text-[12px]">{selectedEndpoint.path}</span>
                    {selectedEndpoint.tags?.map((t) => (
                      <span
                        key={t}
                        className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="text-muted-foreground">
                    {selectedEndpoint.name}
                    {selectedEndpoint.description ? `：${selectedEndpoint.description}` : null}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium">参数配置</span>
                    <span className="text-muted-foreground">
                      默认值用于「单次执行」以及「边界值」基线。
                    </span>
                  </div>
                  <div className="max-h-72 overflow-auto rounded-md border">
                    <table className="w-full border-separate border-spacing-0 text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border-b px-2 py-1 text-left font-medium">名称</th>
                          <th className="border-b px-2 py-1 text-left font-medium">位置</th>
                          <th className="border-b px-2 py-1 text-left font-medium">类型</th>
                          <th className="border-b px-2 py-1 text-left font-medium">默认值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEndpoint.params.map((p) => (
                          <tr key={p.name} className="border-t">
                            <td className="border-b px-2 py-1 align-top font-mono">
                              {p.name}
                              {p.required && (
                                <span className="text-destructive ml-1 text-[10px]">*</span>
                              )}
                            </td>
                            <td className="text-muted-foreground border-b px-2 py-1 align-top text-[11px]">
                              {p.location}
                            </td>
                            <td className="text-muted-foreground border-b px-2 py-1 align-top text-[11px]">
                              {p.type}
                            </td>
                            <td className="border-b px-2 py-1 align-top">
                              <Input
                                className="bg-background h-7 font-mono text-[11px]"
                                value={paramValues[p.name] ?? ''}
                                onChange={(e) => handleParamChange(p.name, e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium">功能性参数边界值</span>
                    <span className="text-muted-foreground">
                      勾选的边界值会生成多条用例，可选择并发或顺序执行。
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {selectedEndpoint.params.map((p) => {
                      if (!p.boundaryCases?.length) return null
                      return (
                        <div key={p.name} className="space-y-1">
                          <div className="text-muted-foreground text-[11px] font-medium">
                            {p.name}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {p.boundaryCases.map((b) => {
                              const active = boundaryEnabled[b.id]
                              return (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => handleToggleBoundary(b.id)}
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]',
                                    active
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-muted bg-muted/40 text-muted-foreground hover:bg-muted'
                                  )}
                                  title={b.description || ''}
                                >
                                  {b.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-card flex min-w-0 flex-1 flex-col gap-3 rounded-xl border p-4 shadow-sm">
            <h2 className="text-sm font-semibold">执行 &amp; 结果</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                size="sm"
                type="button"
                disabled={loading || !selectedEndpoint}
                onClick={() => void run('single')}
                className="flex items-center gap-1"
              >
                <Play className="h-3.5 w-3.5" />
                单次执行（使用默认值）
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                disabled={loading || !selectedEndpoint}
                onClick={() => void run('batch')}
                className="flex items-center gap-1"
              >
                <Play className="h-3.5 w-3.5" />
                多条件并发（边界值）
              </Button>
              <Button
                size="sm"
                type="button"
                variant="outline"
                disabled={loading || !selectedEndpoint}
                onClick={() => void run('sequence')}
                className="flex items-center gap-1"
              >
                <Play className="h-3.5 w-3.5" />
                多条件顺序（边界值）
              </Button>
              {runningMode && (
                <span className="text-muted-foreground">
                  正在执行{' '}
                  {runningMode === 'single' ? '单次' : runningMode === 'batch' ? '并发' : '顺序'}{' '}
                  调用...
                </span>
              )}
            </div>

            {runError && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive mt-2 flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-medium">执行失败</div>
                  <div className="mt-0.5">{runError}</div>
                </div>
              </div>
            )}

            <div className="bg-background mt-2 flex-1 overflow-auto rounded-md border p-2 text-xs">
              {!runResult && !runError && (
                <div className="text-muted-foreground">
                  结果区域：点击上方按钮执行后，会在此展示每个用例的状态码、耗时以及请求/响应详情。
                </div>
              )}
              {runResult && (
                <div className="space-y-2">
                  <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                    <div>
                      Endpoint: <span className="font-mono">{runResult.endpointId}</span> | Base
                      URL: <span className="font-mono">{runResult.baseUrl}</span> | 模式:{' '}
                      {runResult.mode}
                    </div>
                    <div>
                      共 {runResult.results.length} 条用例，成功{' '}
                      {runResult.results.filter((r) => r.ok).length} 条
                    </div>
                  </div>
                  <div className="space-y-2">
                    {runResult.results.map((r, idx) => (
                      <details
                        key={r.id || idx}
                        className={cn(
                          'group rounded-md border px-2 py-1.5',
                          r.ok
                            ? 'border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                            : 'border-destructive/50 bg-destructive/10'
                        )}
                        open={runResult.results.length <= 2}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            {r.ok ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <AlertTriangle className="text-destructive h-3.5 w-3.5" />
                            )}
                            <span className="font-mono text-[11px]">
                              [{idx + 1}] {r.title}
                            </span>
                          </div>
                          <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
                            <span>
                              状态码{' '}
                              <span
                                className={cn(
                                  'font-mono',
                                  r.status >= 200 && r.status < 300
                                    ? 'text-emerald-600'
                                    : 'text-destructive'
                                )}
                              >
                                {r.status}
                              </span>
                            </span>
                            <span>{r.durationMs} ms</span>
                          </div>
                        </summary>
                        <div className="mt-1 grid gap-2 md:grid-cols-2">
                          <div className="space-y-1">
                            <div className="font-medium">Request</div>
                            <pre className="bg-background max-h-56 overflow-auto rounded border p-1.5 font-mono text-[11px]">
                              <code>
                                {r.request.method} {r.request.url}
                                {'\n'}
                                {Object.entries(r.request.headers).map(([k, v]) => `${k}: ${v}\n`)}
                                {r.request.bodyPreview && (
                                  <>
                                    {'\n'}
                                    {r.request.bodyPreview}
                                  </>
                                )}
                              </code>
                            </pre>
                          </div>
                          <div className="space-y-1">
                            <div className="font-medium">Response</div>
                            <pre className="bg-background max-h-56 overflow-auto rounded border p-1.5 font-mono text-[11px]">
                              <code>
                                Status: {r.response.status}
                                {'\n'}
                                {Object.entries(r.response.headers).map(([k, v]) => `${k}: ${v}\n`)}
                                {'\n'}
                                {r.response.bodyText}
                                {r.response.truncated ? '\n\n# body truncated' : ''}
                              </code>
                            </pre>
                          </div>
                        </div>
                        {r.error && (
                          <div className="text-destructive mt-1 text-[11px]">Error: {r.error}</div>
                        )}
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
