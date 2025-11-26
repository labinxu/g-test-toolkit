import { NextRequest, NextResponse } from 'next/server'
import { createClient, createCluster, type RedisClientType } from 'redis'

type SupportedAction = 'insert' | 'search' | 'delete'
type SupportedEnvironment = string
type SupportedDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream'

export const runtime = 'nodejs'

type Driver = 'node' | 'ioredis'

// Minimal Redis-like interface used in this route
type RedisLike = {
  // connection mgmt
  ping: (...args: any[]) => Promise<any>
  quit?: () => Promise<any>

  // generic
  sendCommand: <T = any>(args: string[] | any) => Promise<T>

  // string
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<any>
  del: (key: string) => Promise<any>
  type: (key: string) => Promise<string>

  // hash
  hSet: (key: string, mapping: Record<string, string>) => Promise<any>
  hGetAll: (key: string) => Promise<Record<string, string>>
  hDel: (key: string, ...fields: string[]) => Promise<any>

  // list
  rPush: (key: string, ...items: string[]) => Promise<any>

  // set
  sAdd: (key: string, ...members: string[]) => Promise<any>
  sMembers: (key: string) => Promise<string[]>

  // zset
  zAdd: (key: string, entries: Array<{ value: string; score: number }>) => Promise<any>

  // stream
  xAdd: (key: string, id: string, message: Record<string, string>) => Promise<any>
  xRange: (key: string, start: string, end: string, opts?: any) => Promise<any>
}

type RedisClientMap = Record<string, (RedisClientType & RedisLike) | RedisLike | undefined>
type RedisConnectionConfig = {
  host: string
  port: number
  tls?: boolean
  family?: 4 | 6
  timeoutMs?: number
  cluster?: boolean
}

const globalForRedis = globalThis as unknown as {
  __redisClients?: RedisClientMap
  __redisClientConfigs?: Record<string, RedisConnectionConfig | undefined>
  __redisStopping?: Record<string, boolean>
}

const redisClients: RedisClientMap = globalForRedis.__redisClients ?? {}
const redisClientConfigs: Record<string, RedisConnectionConfig | undefined> =
  globalForRedis.__redisClientConfigs ?? {}

if (!globalForRedis.__redisClients) {
  globalForRedis.__redisClients = redisClients
}
if (!globalForRedis.__redisClientConfigs) {
  globalForRedis.__redisClientConfigs = redisClientConfigs
}
const redisStopping: Record<string, boolean> = globalForRedis.__redisStopping ?? {}
if (!globalForRedis.__redisStopping) {
  globalForRedis.__redisStopping = redisStopping
}

function isStopping(cacheKey: string) {
  return !!redisStopping[cacheKey]
}
function setStopping(cacheKey: string, value: boolean) {
  redisStopping[cacheKey] = !!value
}

// Removed server-side presets; prefer client-provided connection from front-end Parameters
const REDIS_ENDPOINTS: Record<string, RedisConnectionConfig> = {}

function parseCliConnection(value: string): RedisConnectionConfig | null {
  const hostMatch = value.match(/-h\s+([^\s]+)/i)
  const portMatch = value.match(/-p\s+(\d+)/i)
  if (!hostMatch || !portMatch) {
    return null
  }
  const host = hostMatch[1]?.trim()
  const port = Number(portMatch[1])
  if (!host || Number.isNaN(port)) {
    return null
  }
  // Heuristic: AWS ElastiCache endpoints often require TLS
  const tls = /amazonaws\.com$/i.test(host) || /clustercfg/i.test(host)
  return { host, port, tls }
}

function parseUrlConnection(value: string): RedisConnectionConfig | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
      return null
    }
    const port = url.port ? Number(url.port) : 6379
    if (!url.hostname || Number.isNaN(port)) {
      return null
    }
    // Optional query params: family=4|6, timeoutMs=...
    const famRaw = url.searchParams.get('family')
    const family =
      famRaw && (famRaw === '4' || famRaw === '6') ? (Number(famRaw) as 4 | 6) : undefined
    const toRaw = url.searchParams.get('timeoutMs')
    const timeoutMs = toRaw ? Math.max(500, Math.min(120000, Number(toRaw) || 0)) : undefined
    const clusterRaw = url.searchParams.get('cluster')
    const cluster = clusterRaw != null ? /^(1|true|yes|on)$/i.test(clusterRaw) : undefined
    return {
      host: url.hostname,
      port,
      tls: url.protocol === 'rediss:',
      family,
      timeoutMs,
      cluster,
    }
  } catch {
    return null
  }
}

function parseConnection(input: unknown): RedisConnectionConfig | null {
  if (!input) {
    return null
  }

  if (typeof input === 'string') {
    return parseCliConnection(input) ?? parseUrlConnection(input)
  }

  if (isRecord(input)) {
    const hostValue = input.host
    const portValue = input.port
    const tlsValue = (input as any).tls
    const famValue = (input as any).family
    const toValue = (input as any).timeoutMs
    const clValue = (input as any).cluster
    const host = typeof hostValue === 'string' ? hostValue.trim() : null
    const rawPort =
      typeof portValue === 'number'
        ? portValue
        : typeof portValue === 'string'
          ? Number(portValue)
          : null
    const tls = typeof tlsValue === 'boolean' ? tlsValue : undefined
    const family = famValue === 4 || famValue === 6 ? (famValue as 4 | 6) : undefined
    const timeoutMs =
      typeof toValue === 'number'
        ? Math.max(500, Math.min(120000, toValue))
        : typeof toValue === 'string'
          ? Math.max(500, Math.min(120000, Number(toValue) || 0))
          : undefined
    const cluster = typeof clValue === 'boolean' ? clValue : undefined
    if (host && rawPort !== null && !Number.isNaN(rawPort)) {
      return { host, port: rawPort, tls, family, timeoutMs, cluster }
    }
  }

  return null
}

async function getRedisClient(
  env: SupportedEnvironment,
  connection?: RedisConnectionConfig,
  driver: Driver = 'node'
): Promise<RedisLike> {
  const cacheKey = `${env}|${driver}`
  // New attempt; clear any previous stopping flag
  setStopping(cacheKey, false)
  const endpointRaw = connection ?? REDIS_ENDPOINTS[env]
  const endpoint: RedisConnectionConfig | null = endpointRaw
    ? {
        host: endpointRaw.host,
        port: endpointRaw.port,
        // TLS heuristic only when NOT user-provided connection
        tls:
          typeof connection !== 'undefined'
            ? typeof endpointRaw.tls === 'boolean'
              ? endpointRaw.tls
              : false
            : typeof endpointRaw.tls === 'boolean'
              ? endpointRaw.tls
              : /amazonaws\.com$/i.test(endpointRaw.host) || /clustercfg/i.test(endpointRaw.host),
        family: endpointRaw.family,
        timeoutMs: endpointRaw.timeoutMs,
        cluster: endpointRaw.cluster,
      }
    : null
  if (!endpoint) {
    throw new Error(`Redis connection required (no preset for env: ${env})`)
  }
  const cached = redisClients[cacheKey]
  const cachedConfig = redisClientConfigs[cacheKey]
  if (
    cached?.isOpen &&
    cachedConfig?.host === endpoint.host &&
    cachedConfig.port === endpoint.port
  ) {
    return cached
  }

  if (cached) {
    try {
      ;(cached as any).__stopping = true
      const ka: any = (cached as any).__keepAlive
      if (ka) clearInterval(ka)
      const rawKA: any = (cached as any).__raw?.__keepAlive
      if (rawKA) clearInterval(rawKA)
    } catch {}
    try {
      try { await (cached as any).disconnect?.() } catch {}
      await (cached as any).quit?.()
    } catch (error) {
      console.error(`[redis-control] failed to close stale ${env} client`, error)
    }
    delete redisClients[cacheKey]
  }

  // Decide cluster mode:
  // - If a connection object is provided, prefer explicit flag; otherwise fall back to hostname heuristic
  // - For presets (no connection object), use hostname heuristic
  const hostLower = (endpoint.host || '').toLowerCase()
  const heuristicCluster = /clustercfg/.test(hostLower)
  const useCluster =
    typeof connection !== 'undefined'
      ? endpoint.cluster !== undefined
        ? !!endpoint.cluster
        : heuristicCluster
      : heuristicCluster
  console.info(
    `[redis-control] connecting`,
    JSON.stringify({
      env,
      host: endpoint.host,
      port: endpoint.port,
      tls: !!endpoint.tls,
      family: endpoint.family,
      timeoutMs: endpoint.timeoutMs,
      cluster: useCluster,
    })
  )
  const connectTimeout = endpoint.timeoutMs ?? 8000
  if (driver === 'node' && useCluster && endpoint.tls !== undefined) {
    const scheme = endpoint.tls ? 'rediss' : 'redis'
    try {
      const cluster: any = createCluster({
        rootNodes: [{ url: `${scheme}://${endpoint.host}:${endpoint.port}` }],
        defaults: {
          socket: {
            tls: !!endpoint.tls,
            connectTimeout,
            family: endpoint.family ?? 4,
            keepAlive: 10_000,
            noDelay: true,
            reconnectStrategy: (retries: number) => Math.min(200 * retries, 3000),
          },
        },
      })
      ;(cluster as any).__errCount = 0
      cluster.on('error', (error: any) => {
        if (isStopping(cacheKey)) return
        const n = ((cluster as any).__errCount = ((cluster as any).__errCount || 0) + 1)
        if (n > 3) return
        console.error(`[redis-control] ${env} cluster error`, error)
      })
      await cluster.connect()
      try {
        const pong = await cluster.ping()
        console.info(`[redis-control] cluster ping: ${pong}`)
      } catch (e) {
        console.warn('[redis-control] cluster ping failed after connect', (e as any)?.message || String(e))
      }
      console.info(`[redis-control] connected (cluster)`, JSON.stringify({ env }))
      // cache and return
      ;(cluster as any).__keepAlive = setInterval(async () => {
        try {
          await cluster.ping()
        } catch {}
      }, 60_000)
      redisClients[cacheKey] = cluster as unknown as RedisClientType
      redisClientConfigs[cacheKey] = endpoint
      return cluster as unknown as RedisLike
    } catch (e: any) {
      console.error('[redis-control] cluster connect failed, falling back to single node', {
        env,
        error: e?.message || String(e),
      })
      // fallthrough to single
    }
  }
  if (driver === 'node') {
    const client = createClient({
      socket: {
        host: endpoint.host,
        port: endpoint.port,
        tls: !!endpoint.tls,
        connectTimeout,
        family: endpoint.family ?? 4,
        keepAlive: 10_000,
        noDelay: true,
        reconnectStrategy: (retries) => Math.min(200 * retries, 3000),
      },
    })

    ;(client as any).__errCount = 0
    client.on('error', (error) => {
      if (isStopping(cacheKey)) return
      const n = ((client as any).__errCount = ((client as any).__errCount || 0) + 1)
      if (n > 3) return
      console.error(`[redis-control] ${env} client error`, error)
    })

    await client.connect()
    try {
      const pong = await client.ping()
      console.info(`[redis-control] ping: ${pong}`)
    } catch (e) {
      console.warn('[redis-control] ping failed after connect', (e as any)?.message || String(e))
    }
    console.info(`[redis-control] connected`, JSON.stringify({ env }))
    ;(client as any).__keepAlive = setInterval(async () => {
      try {
        await client.ping()
      } catch {}
    }, 60_000)
    redisClients[cacheKey] = client as unknown as RedisLike
    redisClientConfigs[cacheKey] = endpoint
    return client as unknown as RedisLike
  }

  // ---- ioredis driver ----
  try {
    const mod: any = await import('ioredis').catch(() => null as any)
    const IoRedis: any = mod && (mod.default || mod)
    if (!IoRedis) throw new Error('ioredis not installed')

    if (useCluster) {
      const cluster = new IoRedis.Cluster([
        {
          host: endpoint.host,
          port: endpoint.port,
        },
      ], {
        dnsLookup: (addr: string, cb: any) => cb(null, addr),
        redisOptions: {
          tls: endpoint.tls ? {} : undefined,
          family: endpoint.family ?? 4,
          connectTimeout,
          retryStrategy: (times: number) => Math.min(times * 200, 3000),
        },
      })
      // Attach error handler to avoid unhandled error events
      ;(cluster as any).__errCount = 0
      cluster.on('error', (err: any) => {
        if (isStopping(cacheKey)) return
        const n = ((cluster as any).__errCount = ((cluster as any).__errCount || 0) + 1)
        if (n > 3) return
        console.error('[ioredis] cluster error', err?.message || String(err))
      })
      // ioredis Cluster starts connecting automatically; avoid explicit connect to prevent
      // "Redis is already connecting/connected" errors when rapidly toggling drivers.
      try { await cluster.ping() } catch {}
      ;(cluster as any).__keepAlive = setInterval(async () => { try { await cluster.ping() } catch {} }, 60_000)
      const adapter: RedisLike = makeIoRedisAdapter(cluster)
      ;(adapter as any).__raw = cluster
      redisClients[cacheKey] = adapter
      redisClientConfigs[cacheKey] = endpoint
      return adapter
    }

    const client = new IoRedis({
      host: endpoint.host,
      port: endpoint.port,
      tls: endpoint.tls ? {} : undefined,
      family: endpoint.family ?? 4,
      lazyConnect: true,
      connectTimeout,
      retryStrategy: (times: number) => Math.min(times * 200, 3000),
    })
    ;(client as any).__errCount = 0
    client.on('error', (err: any) => {
      if (isStopping(cacheKey)) return
      const n = ((client as any).__errCount = ((client as any).__errCount || 0) + 1)
      if (n > 3) return
      console.error('[ioredis] client error', err?.message || String(err))
    })
    if (typeof client.connect === 'function') {
      // Only connect when not already connecting/ready
      const status = (client as any).status as string | undefined
      if (status !== 'connecting' && status !== 'ready') {
        try { await client.connect() } catch (e: any) {
          // Tolerate already connecting/connected message
          if (!/already connecting|already\s+connected/i.test(String(e?.message || e))) throw e
        }
      }
    }
    try { await client.ping() } catch {}
    ;(client as any).__keepAlive = setInterval(async () => { try { await client.ping() } catch {} }, 60_000)
    const adapter: RedisLike = makeIoRedisAdapter(client)
    ;(adapter as any).__raw = client
    redisClients[cacheKey] = adapter
    redisClientConfigs[cacheKey] = endpoint
    return adapter
  } catch (e: any) {
    console.error('[redis-control] ioredis connect failed', e?.message || String(e))
    throw e
  }
}

function makeIoRedisAdapter(client: any): RedisLike {
  return {
    // passthrough
    ping: (...args: any[]) => client.ping(...args),
    quit: async () => { try { await client.quit() } catch {} },
    type: (key: string) => client.type(key),

    // generic
    sendCommand: async <T = any>(args: string[] | any): Promise<T> => {
      if (Array.isArray(args)) {
        return client.call(args[0], ...args.slice(1))
      }
      return client.call(args?.name || args?.command, ...(args?.args || []))
    },

    // string
    get: (key: string) => client.get(key),
    set: (key: string, value: string) => client.set(key, value),
    del: (key: string) => client.del(key),

    // hash
    hSet: async (key: string, mapping: Record<string, string>) => {
      const pairs: string[] = []
      for (const [f, v] of Object.entries(mapping)) pairs.push(f, v)
      return client.hset(key, ...pairs)
    },
    hGetAll: (key: string) => client.hgetall(key),
    hDel: (key: string, ...fields: string[]) => client.hdel(key, ...fields),

    // list
    rPush: (key: string, ...items: string[]) => client.rpush(key, ...items),

    // set
    sAdd: (key: string, ...members: string[]) => client.sadd(key, ...members),
    sMembers: (key: string) => client.smembers(key),

    // zset
    zAdd: async (key: string, entries: Array<{ value: string; score: number }>) => {
      const pairs: Array<string | number> = []
      for (const e of entries) { pairs.push(e.score, e.value) }
      return client.zadd(key, ...pairs)
    },

    // stream
    xAdd: async (key: string, id: string, message: Record<string, string>) => {
      const pairs: string[] = []
      for (const [f, v] of Object.entries(message)) pairs.push(f, v)
      return client.xadd(key, id, ...pairs)
    },
    xRange: (key: string, start: string, end: string, opts?: any) => {
      if (opts && typeof opts.COUNT === 'number') return client.xrange(key, start, end, 'COUNT', opts.COUNT)
      return client.xrange(key, start, end)
    },
  }
}

function isSupportedAction(value: unknown): value is SupportedAction {
  return value === 'insert' || value === 'search' || value === 'delete'
}

function isSupportedDataType(value: unknown): value is SupportedDataType {
  return (
    value === 'string' ||
    value === 'hash' ||
    value === 'list' ||
    value === 'set' ||
    value === 'zset' ||
    value === 'stream'
  )
}

class HttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function badRequest(message: string): never {
  throw new HttpError(message, 400)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseArrayInput(raw: string, emptyMessage: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    badRequest(emptyMessage)
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => String(item))
    }
  } catch {}

  const tokens = trimmed
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    badRequest(emptyMessage)
  }

  return tokens
}

function parseHashInput(raw: string) {
  try {
    const parsed = JSON.parse(raw)
    if (isRecord(parsed)) {
      const result: Record<string, string> = {}
      for (const [field, value] of Object.entries(parsed)) {
        result[String(field)] = String(value)
      }
      if (Object.keys(result).length === 0) {
        badRequest('Hash value must contain at least one field')
      }
      return result
    }
  } catch {}
  badRequest('Hash value must be a JSON object')
}

function parseZSetInput(raw: string) {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const result: Array<{ value: string; score: number }> = []
      for (const entry of parsed) {
        if (Array.isArray(entry) && entry.length >= 2) {
          const value = String(entry[0])
          const score = Number(entry[1])
          if (Number.isNaN(score)) {
            badRequest('ZSet score must be a number')
          }
          result.push({ value, score })
          continue
        }
        if (isRecord(entry)) {
          const member = entry['member'] ?? entry['value']
          const scoreValue = entry['score']
          const score = Number(scoreValue)
          if (member === undefined || Number.isNaN(score)) {
            badRequest('ZSet entries must include member/value and score')
          }
          result.push({ value: String(member), score })
          continue
        }
        badRequest('ZSet entries must be an array [member, score] or object {member, score}')
      }
      return result
    }
  } catch {}
  badRequest('ZSet value must be a JSON array')
}

function parseStreamInput(raw: string) {
  try {
    const parsed = JSON.parse(raw)
    if (isRecord(parsed)) {
      const message: Record<string, string> = {}
      for (const [field, value] of Object.entries(parsed)) {
        message[String(field)] = String(value)
      }
      if (Object.keys(message).length === 0) {
        badRequest('Stream value must contain at least one field')
      }
      return message
    }
  } catch {}
  badRequest('Stream value must be a JSON object')
}

function parseZSetMembersInput(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    badRequest('ZSet delete value must include at least one member')
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const members: string[] = []
      for (const entry of parsed) {
        if (Array.isArray(entry) && entry.length > 0) {
          members.push(String(entry[0]))
          continue
        }
        if (isRecord(entry)) {
          const member = entry['member'] ?? entry['value']
          if (member === undefined) {
            badRequest('ZSet delete entries must include member/value')
          }
          members.push(String(member))
          continue
        }
        members.push(String(entry))
      }
      return members
    }
    if (typeof parsed === 'string' || typeof parsed === 'number') {
      return [String(parsed)]
    }
  } catch {}

  const tokens = trimmed
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    badRequest('ZSet delete value must include at least one member')
  }

  return tokens
}

function parseStreamDeleteInput(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    badRequest('Stream delete value must include at least one entry ID')
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((value) => String(value)).filter(Boolean)
    }
    if (typeof parsed === 'string' || typeof parsed === 'number') {
      return [String(parsed)]
    }
  } catch {}

  const tokens = trimmed
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    badRequest('Stream delete value must include at least one entry ID')
  }

  return tokens
}

async function insertValue(
  client: RedisLike,
  key: string,
  dataType: SupportedDataType,
  rawValue: string
) {
  switch (dataType) {
    case 'string': {
      await client.set(key, rawValue)
      return
    }
    case 'hash': {
      const mapping = parseHashInput(rawValue)
      await client.hSet(key, mapping)
      return
    }
    case 'list': {
      const items = parseArrayInput(rawValue, 'List value must include at least one item')
      await client.rPush(key, ...items)
      return
    }
    case 'set': {
      const members = parseArrayInput(rawValue, 'Set value must include at least one member')
      await client.sAdd(key, ...members)
      return
    }
    case 'zset': {
      const entries = parseZSetInput(rawValue)
      await client.zAdd(
        key,
        entries.map(({ value, score }) => ({ value, score }))
      )
      return
    }
    case 'stream': {
      const message = parseStreamInput(rawValue)
      await client.xAdd(key, '*', message)
      return
    }
    default:
      badRequest(`Unsupported data type: ${String(dataType)}`)
  }
}

async function deleteValue(
  client: RedisLike,
  key: string,
  dataType: SupportedDataType,
  rawValue: string
) {
  switch (dataType) {
    case 'string': {
      await client.del(key)
      return
    }
    case 'hash': {
      const mapping = parseHashInput(rawValue)
      const fields = Object.keys(mapping)
      if (fields.length > 0) {
        await client.hDel(key, ...fields)
      }
      return
    }
    case 'list': {
      const items = parseArrayInput(rawValue, 'List delete value must include at least one item')
      for (const item of items) {
        await client.lRem(key, 0, item)
      }
      return
    }
    case 'set': {
      const members = parseArrayInput(rawValue, 'Set delete value must include at least one member')
      if (members.length > 0) {
        await client.sRem(key, ...members)
      }
      return
    }
    case 'zset': {
      const members = parseZSetMembersInput(rawValue)
      if (members.length > 0) {
        await client.zRem(key, ...members)
      }
      return
    }
    case 'stream': {
      const ids = parseStreamDeleteInput(rawValue)
      if (ids.length > 0) {
        await client.xDel(key, ...ids)
      }
      return
    }
    default:
      badRequest(`Unsupported data type: ${String(dataType)}`)
  }
}
async function readKeyValue(client: RedisLike, key: string) {
  const keyType = await client.type(key)

  switch (keyType) {
    case 'none':
      return { type: 'none', value: null }
    case 'string': {
      const value = await client.get(key)
      return { type: keyType, value }
    }
    case 'hash': {
      const value = await client.hGetAll(key)
      return { type: keyType, value }
    }
    case 'list': {
      const value = await client.lRange(key, 0, -1)
      return { type: keyType, value }
    }
    case 'set': {
      const value = await client.sMembers(key)
      return { type: keyType, value }
    }
    case 'zset': {
      const raw = await client.sendCommand<string[]>(['ZRANGE', key, '0', '-1', 'WITHSCORES'])
      const value: Array<{ member: string; score: number }> = []
      for (let index = 0; index < raw.length; index += 2) {
        value.push({
          member: raw[index] ?? '',
          score: Number(raw[index + 1] ?? 0),
        })
      }
      return { type: keyType, value }
    }
    case 'stream': {
      const value = await client.xRange(key, '-', '+', { COUNT: 100 })
      return { type: keyType, value }
    }
    default: {
      const dumped = await client.sendCommand<Buffer | null>(['DUMP', key])
      return { type: keyType, value: dumped?.toString('base64') ?? null }
    }
  }
}

export async function POST(req: NextRequest) {
  let payload: {
    action?: unknown
    env?: unknown
    key?: unknown
    value?: unknown
    connection?: unknown
    dataType?: unknown
    driver?: unknown
  } = {}

  try {
    payload = await req.json()
    console.info('[redis-control] request', {
      action: (payload as any)?.action,
      env: (payload as any)?.env,
      key: (payload as any)?.key,
      dataType: (payload as any)?.dataType,
      connection: (() => {
        const c: any = (payload as any)?.connection
        if (!c) return undefined
        try {
          if (typeof c === 'string') return c
          if (typeof c === 'object')
            return {
              host: (c as any)?.host,
              port: (c as any)?.port,
              tls: (c as any)?.tls,
            }
        } catch {}
        return 'unknown'
      })(),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, env, key, value, connection, dataType } = payload ?? {}
  const driverRaw = (payload as any)?.driver
  const driver: Driver = driverRaw === 'ioredis' ? 'ioredis' : 'node'

  if (!isSupportedAction(action)) {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  if (typeof env !== 'string' || env.trim() === '') {
    return NextResponse.json({ error: 'Environment is required' }, { status: 400 })
  }
  const trimmedEnv = env.trim()

  if (typeof key !== 'string' || key.trim() === '') {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 })
  }

  if (
    (action === 'insert' || action === 'delete') &&
    (typeof value !== 'string' || value.trim() === '')
  ) {
    return NextResponse.json({ error: 'Value is required for this action' }, { status: 400 })
  }

  if ((action === 'insert' || action === 'delete') && !isSupportedDataType(dataType)) {
    return NextResponse.json({ error: 'Unsupported data type' }, { status: 400 })
  }

  try {
    const parsedConnection = parseConnection(connection)
    const client = await getRedisClient(trimmedEnv, parsedConnection ?? undefined, driver)
    console.info('[redis-control] executing', {
      action,
      env: trimmedEnv,
      key,
      dataType,
      driver,
    })
    const trimmedKey = key.trim()
    const trimmedValue = typeof value === 'string' ? value.trim() : ''

    if (action === 'insert') {
      await insertValue(client, trimmedKey, dataType as SupportedDataType, trimmedValue)
      const result = await readKeyValue(client, trimmedKey)
      return NextResponse.json({
        key: trimmedKey,
        ...result,
        action: 'inserted',
      })
    }

    if (action === 'delete') {
      await deleteValue(client, trimmedKey, dataType as SupportedDataType, trimmedValue)
      const result = await readKeyValue(client, trimmedKey)
      return NextResponse.json({
        key: trimmedKey,
        ...result,
        action: 'deleted',
      })
    }

    const result = await readKeyValue(client, trimmedKey)
    return NextResponse.json({ key: trimmedKey, ...result, action: 'search' })
  } catch (error) {
    console.error('[redis-control] request failed', {
      error: (error as any)?.message || String(error),
      stack: (error as any)?.stack,
    })
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Redis operation failed' }, { status: 500 })
  }
}

// Simple health/driver info endpoint
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const env = (url.searchParams.get('env') || '').trim()
    if (!env) return NextResponse.json({ error: 'env is required' }, { status: 400 })
    const driverRaw = (url.searchParams.get('driver') || '').trim().toLowerCase()
    const driver: Driver = driverRaw === 'ioredis' ? 'ioredis' : 'node'
    const connRaw = url.searchParams.get('connection') || ''
    const parsedConnection = parseConnection(connRaw || undefined)
    const client = await getRedisClient(env, parsedConnection ?? undefined, driver)
    let ping = ''
    try { ping = String(await client.ping()) } catch { ping = '' }
    return NextResponse.json({ ok: true, env, driver, ping, timestamp: Date.now() })
  } catch (error) {
    return NextResponse.json({ error: (error as any)?.message || 'health failed' }, { status: 500 })
  }
}

// Stop (close and remove) cached client for env+driver
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const env = (url.searchParams.get('env') || '').trim()
    if (!env) return NextResponse.json({ error: 'env is required' }, { status: 400 })
    const driverRaw = (url.searchParams.get('driver') || '').trim().toLowerCase()
    const driver: Driver = driverRaw === 'ioredis' ? 'ioredis' : 'node'
    const cacheKey = `${env}|${driver}`
    // Mark as stopping to suppress further error logs
    try { setStopping(cacheKey, true) } catch {}
    const cached = redisClients[cacheKey]
    if (!cached) return NextResponse.json({ ok: true, stopped: false, message: 'no client' })
    try {
      const ka: any = (cached as any).__keepAlive
      if (ka) clearInterval(ka)
      const rawKA: any = (cached as any).__raw?.__keepAlive
      if (rawKA) clearInterval(rawKA)
    } catch {}
    try { await cached.quit?.() } catch {}
    delete redisClients[cacheKey]
    delete redisClientConfigs[cacheKey]
    return NextResponse.json({ ok: true, stopped: true, env, driver })
  } catch (error) {
    return NextResponse.json({ error: (error as any)?.message || 'stop failed' }, { status: 500 })
  }
}
