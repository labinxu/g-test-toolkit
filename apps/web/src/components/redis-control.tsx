'use client'

import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { javascript } from '@codemirror/lang-javascript'
import CodeMirror from '@uiw/react-codemirror'
import { useTheme } from 'next-themes'
import {
  Loader2,
  UserMinus,
  UserSearch,
  SlidersHorizontal,
  UserPlus,
  Activity,
  X,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'

import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream'

type RedisEnvironment = string | 'custom'

type RedisConn = {
  host: string
  port: number
  tls?: boolean
  cluster?: boolean
}

function readRedisConnections(): Record<string, RedisConn> {
  try {
    const raw = localStorage.getItem('gtt:redis:connections') || ''
    if (!raw.trim()) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as any
  } catch {}
  return {}
}

const DATA_TYPE_OPTIONS: OptionsSelectItem<RedisDataType>[] = [
  { value: 'string', label: 'String' },
  { value: 'hash', label: 'Hash' },
  { value: 'list', label: 'List' },
  { value: 'set', label: 'Set' },
  { value: 'zset', label: 'ZSet' },
  { value: 'stream', label: 'Stream' },
]

const DEFAULT_ENVIRONMENT: RedisEnvironment = 'custom'
const DEFAULT_DATA_TYPE: RedisDataType = 'string'

function normalizeResult(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export type RedisControlProps = {
  defaultKey?: string
  defaultType?: RedisDataType | string | null
  resultsCollapsible?: boolean
  resultsTitle?: string
  initialResultsOpen?: boolean
}

function normalizeDataType(input: RedisControlProps['defaultType']): RedisDataType {
  if (!input || typeof input !== 'string') {
    return DEFAULT_DATA_TYPE
  }
  const normalized = input.trim().toLowerCase()
  if (DATA_TYPE_OPTIONS.some((option) => option.value === normalized)) {
    return normalized as RedisDataType
  }
  return DEFAULT_DATA_TYPE
}

export function RedisControl({
  defaultKey,
  defaultType,
  resultsCollapsible,
  resultsTitle,
  initialResultsOpen,
}: RedisControlProps = {}) {
  const [environment, setEnvironment] = useState<RedisEnvironment>(DEFAULT_ENVIRONMENT)
  const [envOptions, setEnvOptions] = useState<OptionsSelectItem<RedisEnvironment>[]>([
    { value: 'custom', label: 'CUSTOM' },
  ])
  const [redisMap, setRedisMap] = useState<Record<string, RedisConn>>({})
  const [dataType, setDataType] = useState<RedisDataType>(normalizeDataType(defaultType))
  const [redisKey, setRedisKey] = useState(defaultKey ?? '')
  const [redisValue, setRedisValue] = useState('')
  const [richTextValue, setRichTextValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<'insert' | 'delete' | 'search' | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [family, setFamily] = useState<'default' | '4' | '6'>('default')
  const [timeoutMs, setTimeoutMs] = useState<number>(8000)
  const [customHost, setCustomHost] = useState('')
  const [customPort, setCustomPort] = useState<number>(6379)
  const [customTls, setCustomTls] = useState<boolean>(true)
  const [customCluster, setCustomCluster] = useState<boolean>(false)
  const [driver, setDriver] = useState<'node' | 'ioredis'>('node')
  const [healthLoading, setHealthLoading] = useState(false)
  const [lastHealthOk, setLastHealthOk] = useState(false)
  const healthAbortRef = useRef<AbortController | null>(null)
  const actionAbortRef = useRef<AbortController | null>(null)
  const [resultsOpen, setResultsOpen] = useState<boolean>(!!initialResultsOpen)

  const { theme } = useTheme()

  const codeMirrorExtensions = useMemo(() => [javascript({ jsx: true, typescript: true })], [])
  const valuePlaceholder = useMemo(() => {
    switch (dataType) {
      case 'hash':
        return 'Value (JSON object, e.g. {"field":"value"})'
      case 'list':
        return 'Value (JSON array or comma separated items)'
      case 'set':
        return 'Value (JSON array or comma separated items)'
      case 'zset':
        return 'Value (JSON array, e.g. [{"member":"a","score":1}])'
      case 'stream':
        return 'Value (JSON object, e.g. {"field":"value"})'
      default:
        return 'Value'
    }
  }, [dataType])

  useEffect(() => {
    setRedisKey(defaultKey ?? '')
  }, [defaultKey])

  useEffect(() => {
    setDataType(normalizeDataType(defaultType))
  }, [defaultType])

  const insertLoading = isLoading && activeAction === 'insert'
  const deleteLoading = isLoading && activeAction === 'delete'
  const searchLoading = isLoading && activeAction === 'search'

  // Load redis env mapping from Parameters (localStorage)
  useEffect(() => {
    const refresh = () => {
      const map = readRedisConnections()
      setRedisMap(map)
      const keys = Object.keys(map)
      const opts: OptionsSelectItem<RedisEnvironment>[] = [
        ...keys.map((k) => ({
          value: k as RedisEnvironment,
          label: k.toUpperCase(),
        })),
        { value: 'custom', label: 'CUSTOM' },
      ]
      setEnvOptions(opts)
      if (keys.length > 0) {
        setEnvironment((prev) =>
          prev === 'custom' || !map[prev] ? (keys[0] as RedisEnvironment) : prev
        )
      } else {
        setEnvironment('custom')
      }
    }
    refresh()
    const onUpdated = () => refresh()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gtt:redis:connections') refresh()
    }
    window.addEventListener('gtt-parameters-updated', onUpdated as any)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('gtt-parameters-updated', onUpdated as any)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const requestRedis = useCallback(
    async (action: 'insert' | 'search' | 'delete') => {
      const trimmedKey = redisKey.trim()
      const trimmedValue = redisValue.trim()

      if (!trimmedKey) {
        throw new Error('Please provide a Redis key first')
      }
      if (action !== 'search' && trimmedValue === '') {
        throw new Error('Value is required for this action')
      }

      // Build connection config
      const baseConn =
        environment === 'custom'
          ? {
              host: customHost.trim(),
              port: Number(customPort) || 0,
              tls: !!customTls,
              cluster: !!customCluster,
            }
          : (redisMap[environment] as RedisConn | undefined)

      if (environment === 'custom') {
        if (!baseConn.host || !baseConn.port) {
          throw new Error('Please provide custom host and port')
        }
      } else if (!baseConn) {
        throw new Error(
          'No preset for selected environment. Configure in Parameters → Redis Connections'
        )
      }

      const ac = new AbortController()
      actionAbortRef.current = ac
      const response = await fetch('/api/redis/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          env: environment,
          key: trimmedKey,
          value: action === 'search' ? undefined : trimmedValue,
          dataType: action === 'search' ? undefined : dataType,
          connection: {
            ...baseConn,
            ...(family !== 'default' ? { family: family === '4' ? 4 : 6 } : {}),
            ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeoutMs } : {}),
          },
          driver,
        }),
        signal: ac.signal,
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | Record<string, unknown>
        | null

      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'error' in payload ? payload.error : null
        throw new Error((typeof message === 'string' && message) || 'Redis request failed')
      }

      return payload ?? ''
    },
    [environment, dataType, redisKey, redisValue]
  )

  const handleSearch = useCallback(async () => {
    try {
      setIsLoading(true)
      setActiveAction('search')
      setError(null)
      const result = await requestRedis('search')
      setRichTextValue(normalizeResult(result))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setIsLoading(false)
      setActiveAction(null)
      if (actionAbortRef.current) actionAbortRef.current = null
    }
  }, [requestRedis])

  const buildConnectionUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (family !== 'default') params.set('family', family)
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) params.set('timeoutMs', String(timeoutMs))
    if (environment === 'custom') {
      const scheme = customTls ? 'rediss' : 'redis'
      if (customCluster) params.set('cluster', '1')
      const qs = params.toString()
      return `${scheme}://${customHost}:${customPort}${qs ? `?${qs}` : ''}`
    }
    const preset = redisMap[environment]
    if (!preset) return ''
    const scheme = preset.tls ? 'rediss' : 'redis'
    if (preset.cluster) params.set('cluster', '1')
    const qs = params.toString()
    return `${scheme}://${preset.host}:${preset.port}${qs ? `?${qs}` : ''}`
  }, [environment, customHost, customPort, customTls, family, timeoutMs, customCluster, redisMap])

  const handleHealth = useCallback(async () => {
    try {
      setHealthLoading(true)
      setError(null)
      const t0 =
        typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const params = new URLSearchParams({ env: environment, driver })
      const conn = buildConnectionUrl()
      if (conn) params.set('connection', conn)
      const ac = new AbortController()
      healthAbortRef.current = ac
      const res = await fetch(`/api/redis/control?${params.toString()}`, {
        method: 'GET',
        signal: ac.signal,
      })
      const data = await res.json().catch(() => ({}) as any)
      if (!res.ok) throw new Error(data?.error || 'Health check failed')
      setRichTextValue(normalizeResult(data))
      const t1 =
        typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const ms = Math.max(0, Math.round(t1 - t0))
      setLastHealthOk(true)
      toast.success(`Health: ${driver} ${environment} ${data?.ping ?? 'OK'} (${ms}ms)`)
    } catch (e: any) {
      setError(e?.message || 'Health check failed')
      if (e?.name === 'AbortError') {
        toast.message('Health check aborted')
      } else {
        setLastHealthOk(false)
        toast.error(e?.message || 'Health check failed')
      }
    } finally {
      setHealthLoading(false)
      if (healthAbortRef.current) healthAbortRef.current = null
    }
  }, [environment, driver, buildConnectionUrl])

  const handleStop = useCallback(async () => {
    try {
      // abort in-flight health
      if (healthAbortRef.current) {
        try {
          healthAbortRef.current.abort()
        } catch {}
        healthAbortRef.current = null
      }
      const params = new URLSearchParams({ env: environment, driver })
      const res = await fetch(`/api/redis/control?${params.toString()}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}) as any)
      if (!res.ok) throw new Error(data?.error || 'Stop failed')
      setLastHealthOk(false)
      toast.success(`Stopped: ${driver} ${environment}`)
    } catch (e: any) {
      toast.error(e?.message || 'Stop failed')
    } finally {
      setHealthLoading(false)
    }
  }, [environment, driver])

  const handleHealthToggle = useCallback(() => {
    if (healthLoading) {
      // stop any connecting/connected client and abort
      handleStop()
      return
    }
    if (lastHealthOk) {
      // if already connected, clicking toggles to stop
      handleStop()
      return
    }
    handleHealth()
  }, [healthLoading, lastHealthOk, handleStop, handleHealth])

  const handleInsert = useCallback(async () => {
    try {
      setIsLoading(true)
      setActiveAction('insert')
      setError(null)
      await requestRedis('insert')
      const result = await requestRedis('search')
      setRichTextValue(normalizeResult(result))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Insert failed')
    } finally {
      setIsLoading(false)
      setActiveAction(null)
      if (actionAbortRef.current) actionAbortRef.current = null
    }
  }, [requestRedis])

  const handleDelete = useCallback(async () => {
    try {
      setIsLoading(true)
      setActiveAction('delete')
      setError(null)
      await requestRedis('delete')
      const result = await requestRedis('search')
      setRichTextValue(normalizeResult(result))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setIsLoading(false)
      setActiveAction(null)
      if (actionAbortRef.current) actionAbortRef.current = null
    }
  }, [requestRedis])

  const handleActionStop = useCallback(async () => {
    try {
      if (actionAbortRef.current) {
        try {
          actionAbortRef.current.abort()
        } catch {}
        actionAbortRef.current = null
      }
      // Also ask backend to stop env+driver client if any
      const params = new URLSearchParams({ env: environment, driver })
      await fetch(`/api/redis/control?${params.toString()}`, {
        method: 'DELETE',
      }).catch(() => {})
      setIsLoading(false)
      setActiveAction(null)
      toast.message('Action aborted')
    } catch {}
  }, [environment, driver])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-row justify-between gap-3">
        <div className="flex flex-row gap-2">
          <OptionsSelect
            id="redis-environment"
            items={envOptions}
            value={environment}
            onSelect={({ value }) => setEnvironment(value)}
            triggerClassName="w-[160px]"
          />
          <OptionsSelect
            id="redis-driver"
            items={[
              { label: 'node-redis', value: 'node' },
              { label: 'ioredis', value: 'ioredis' },
            ]}
            value={driver}
            onSelect={({ value }) => setDriver(value as 'node' | 'ioredis')}
            triggerClassName="w-[140px]"
          />

          <Input
            placeholder="Redis key"
            value={redisKey}
            onChange={(event) => setRedisKey(event.target.value)}
            className="w-min[56px]"
          />
          <OptionsSelect
            id="redis-data-type"
            items={DATA_TYPE_OPTIONS}
            value={dataType}
            onSelect={({ value }) => setDataType(value)}
            triggerClassName="w-[160px]"
          />
          <Input
            placeholder={valuePlaceholder}
            value={redisValue}
            onChange={(event) => setRedisValue(event.target.value)}
            className="w-max[40px]"
          />
          <Button
            variant="outline"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="shrink-0"
            size="icon"
            title={advancedOpen ? 'Hide Advanced' : 'Advanced'}
            aria-label="Advanced settings"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleHealthToggle}
            size="icon"
            variant="secondary"
            disabled={isLoading}
            title={healthLoading ? 'Stop' : lastHealthOk ? 'Stop' : 'Health check'}
            aria-label={healthLoading ? 'Stop' : lastHealthOk ? 'Stop' : 'Health check'}
            className={cn(
              lastHealthOk && !healthLoading
                ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                : ''
            )}
          >
            {healthLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Activity className="size-4" />
            )}
          </Button>
          <Button
            onClick={insertLoading ? handleActionStop : handleInsert}
            size="icon"
            disabled={isLoading && !insertLoading}
            title={insertLoading ? 'Stop' : 'Insert'}
            aria-label={insertLoading ? 'Stop' : 'Insert'}
          >
            {insertLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            <span className="sr-only">{insertLoading ? 'Stop' : 'Insert'}</span>
          </Button>
          <Button
            onClick={deleteLoading ? handleActionStop : handleDelete}
            size="icon"
            variant="destructive"
            disabled={isLoading && !deleteLoading}
            title={deleteLoading ? 'Stop' : 'Delete'}
            aria-label={deleteLoading ? 'Stop' : 'Delete'}
          >
            {deleteLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserMinus className="size-4" />
            )}
            <span className="sr-only">{deleteLoading ? 'Stop' : 'Delete'}</span>
          </Button>
          <Button
            onClick={searchLoading ? handleActionStop : handleSearch}
            size="icon"
            variant="outline"
            disabled={isLoading && !searchLoading}
            title={searchLoading ? 'Stop' : 'Search'}
            aria-label={searchLoading ? 'Stop' : 'Search'}
          >
            {searchLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserSearch className="size-4" />
            )}
            <span className="sr-only">{searchLoading ? 'Stop' : 'Search'}</span>
          </Button>
        </div>
      </div>
      {/* Stop is integrated into Insert/Delete/Search buttons when active */}
      {advancedOpen && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[160px]">
            <OptionsSelect
              id="redis-family"
              items={[
                { label: 'Default', value: 'default' },
                { label: 'IPv4', value: '4' },
                { label: 'IPv6', value: '6' },
              ]}
              defaultValue={family}
              onSelect={({ value }) => setFamily(value as 'default' | '4' | '6')}
              placeholder="Network family"
            />
          </div>
          <div className="w-[160px]">
            <Input
              type="number"
              min={500}
              max={120000}
              value={timeoutMs}
              onChange={(e) =>
                setTimeoutMs(Math.max(500, Math.min(120000, Number(e.target.value) || 0)))
              }
              placeholder="Timeout (ms)"
            />
          </div>

          <div className="text-muted-foreground text-xs">
            Applied to current request (family/timeout)
          </div>
        </div>
      )}
      {environment === 'custom' && (
        <div className="flex flex-row gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={customCluster} onCheckedChange={(v) => setCustomCluster(!!v)} />
            <span className="text-muted-foreground text-xs">Cluster</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={customTls} onCheckedChange={(v) => setCustomTls(!!v)} />
            <span className="text-muted-foreground text-xs">TLS</span>
          </div>
          <Input
            placeholder="Host"
            value={customHost}
            onChange={(e) => setCustomHost(e.target.value)}
            className="w-[220px]"
          />
          <Input
            type="number"
            placeholder="Port"
            value={customPort}
            onChange={(e) => setCustomPort(Math.max(1, Number(e.target.value) || 0))}
            className="w-[100px]"
          />
        </div>
      )}
      {resultsCollapsible ? (
        <div className="flex w-full flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{resultsTitle ?? 'Results'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setResultsOpen((prev) => !prev)}
              >
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', resultsOpen ? 'rotate-180' : '')}
                />
                <span className="ml-1 text-xs">{resultsOpen ? 'Collapse' : 'Expand'}</span>
              </Button>
            </div>
          </div>
          {resultsOpen && (
            <>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              <div className="w-full rounded-md border">
                <CodeMirror
                  value={richTextValue}
                  readOnly
                  height="240px"
                  minHeight="220px"
                  maxHeight="400px"
                  extensions={codeMirrorExtensions}
                  theme={theme === 'dark' ? 'dark' : 'light'}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: true,
                    highlightActiveLineGutter: true,
                    bracketMatching: true,
                    autocompletion: true,
                  }}
                  className="w-full text-sm"
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <p className={cn('text-muted-foreground text-sm', richTextValue && 'hidden')}>
              Results will be displayed here
            </p>
          )}
          <div className="min-h-[240px] w-full overflow-hidden rounded-md border">
            <CodeMirror
              value={richTextValue}
              readOnly
              height="240px"
              minHeight="240px"
              maxHeight="400px"
              extensions={codeMirrorExtensions}
              theme={theme === 'dark' ? 'dark' : 'light'}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                bracketMatching: true,
                autocompletion: true,
              }}
              className="w-full text-sm"
            />
          </div>
        </>
      )}
    </div>
  )
}
