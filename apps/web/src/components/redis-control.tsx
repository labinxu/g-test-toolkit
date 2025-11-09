'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { javascript } from '@codemirror/lang-javascript'
import CodeMirror from '@uiw/react-codemirror'
import { useTheme } from 'next-themes'
import { Loader2, Minus, Plus, Search as SearchIcon } from 'lucide-react'

import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream'

const REDIS_CONNECTIONS = {
  'qa1-corebe': {
    host: 'abc-qa-core-be-redis-qa1.cu5ewp.clustercfg.use1.cache.amazonaws.com',
    port: 6379,
  },
  'qa4-corebe': {
    host: 'abc-qa-core-be-redis-qa4.cu5ewp.clustercfg.use1.cache.amazonaws.com',
    port: 6379,
  },
  'qa1-notif': {
    host: 'notif-redis-qa1-master.qa1-notification.svc.cluster.local',
    port: 6379,
  },
  'qa4-notif': {
    host: 'notif-redis-qa1-master.qa1-notification.svc.cluster.local',
    port: 6379,
  },
} as const

type RedisEnvironment = keyof typeof REDIS_CONNECTIONS

const REDIS_ENVIRONMENT_KEYS = Object.keys(REDIS_CONNECTIONS) as RedisEnvironment[]

const REDIS_OPTIONS: OptionsSelectItem<RedisEnvironment>[] = REDIS_ENVIRONMENT_KEYS.map(
  (value) => ({
    value,
    label: value.toUpperCase(),
  })
)

const DATA_TYPE_OPTIONS: OptionsSelectItem<RedisDataType>[] = [
  { value: 'string', label: 'String' },
  { value: 'hash', label: 'Hash' },
  { value: 'list', label: 'List' },
  { value: 'set', label: 'Set' },
  { value: 'zset', label: 'ZSet' },
  { value: 'stream', label: 'Stream' },
]

const DEFAULT_ENVIRONMENT: RedisEnvironment = REDIS_ENVIRONMENT_KEYS[0] ?? 'qa1-corebe'
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

export function RedisControl({ defaultKey, defaultType }: RedisControlProps = {}) {
  const [environment, setEnvironment] = useState<RedisEnvironment>(DEFAULT_ENVIRONMENT)
  const [dataType, setDataType] = useState<RedisDataType>(normalizeDataType(defaultType))
  const [redisKey, setRedisKey] = useState(defaultKey ?? '')
  const [redisValue, setRedisValue] = useState('')
  const [richTextValue, setRichTextValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<'insert' | 'delete' | 'search' | null>(null)

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
          connection: REDIS_CONNECTIONS[environment],
        }),
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
    }
  }, [requestRedis])

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
    }
  }, [requestRedis])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-row justify-between gap-3">
        <div className="flex flex-row gap-2">
          <OptionsSelect
            id="redis-environment"
            items={REDIS_OPTIONS}
            defaultValue={environment}
            onSelect={({ value }) => setEnvironment(value)}
            triggerClassName="w-[160px]"
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
            defaultValue={dataType}
            onSelect={({ value }) => setDataType(value)}
            triggerClassName="w-[160px]"
          />
          <Input
            placeholder={valuePlaceholder}
            value={redisValue}
            onChange={(event) => setRedisValue(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleInsert} size="icon" disabled={isLoading}>
            {insertLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            <span className="sr-only">Insert</span>
          </Button>
          <Button onClick={handleDelete} size="icon" variant="destructive" disabled={isLoading}>
            {deleteLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Minus className="size-4" />
            )}
            <span className="sr-only">Delete</span>
          </Button>
          <Button onClick={handleSearch} size="icon" variant="outline" disabled={isLoading}>
            {searchLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SearchIcon className="size-4" />
            )}
            <span className="sr-only">Search</span>
          </Button>
        </div>
      </div>
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
    </div>
  )
}
