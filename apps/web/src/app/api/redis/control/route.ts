import { NextRequest, NextResponse } from 'next/server'
import { createClient, type RedisClientType } from 'redis'

type SupportedAction = 'insert' | 'search' | 'delete'
type SupportedEnvironment = string
type SupportedDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream'

export const runtime = 'nodejs'

type RedisClientMap = Record<string, RedisClientType | undefined>
type RedisConnectionConfig = { host: string; port: number }

const globalForRedis = globalThis as unknown as {
  __redisClients?: RedisClientMap
  __redisClientConfigs?: Record<string, RedisConnectionConfig | undefined>
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

const REDIS_ENDPOINTS: Record<string, RedisConnectionConfig> = {
  qa1: {
    host: 'abc-qa-core-be-redis-qa1.cu5ewp.clustercfg.use1.cache.amazonaws.com',
    port: 6379,
  },
  qa4: {
    host: 'abc-qa-core-be-redis-qa4.cu5ewp.clustercfg.use1.cache.amazonaws.com',
    port: 6379,
  },
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
    host: 'notif-redis-qa4-master.qa4-notification.svc.cluster.local',
    port: 6379,
  },
}

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
  return { host, port }
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
    return { host: url.hostname, port }
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
    const host = typeof hostValue === 'string' ? hostValue.trim() : null
    const rawPort =
      typeof portValue === 'number'
        ? portValue
        : typeof portValue === 'string'
          ? Number(portValue)
          : null
    if (host && rawPort !== null && !Number.isNaN(rawPort)) {
      return { host, port: rawPort }
    }
  }

  return null
}

async function getRedisClient(env: SupportedEnvironment, connection?: RedisConnectionConfig) {
  const endpoint = connection ?? REDIS_ENDPOINTS[env]
  if (!endpoint) {
    throw new Error(`Redis endpoint not configured for env: ${env}`)
  }

  const cached = redisClients[env]
  const cachedConfig = redisClientConfigs[env]
  if (cached?.isOpen && cachedConfig?.host === endpoint.host && cachedConfig.port === endpoint.port) {
    return cached
  }

  if (cached) {
    try {
      await cached.quit()
    } catch (error) {
      console.error(`[redis-control] failed to close stale ${env} client`, error)
    }
    delete redisClients[env]
  }

  const client = createClient({
    socket: {
      host: endpoint.host,
      port: endpoint.port,
    },
  })

  client.on('error', (error) => {
    console.error(`[redis-control] ${env} client error`, error)
  })

  await client.connect()
  redisClients[env] = client
  redisClientConfigs[env] = endpoint
  return client
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
  client: RedisClientType,
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
  client: RedisClientType,
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
async function readKeyValue(client: RedisClientType, key: string) {
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
  } = {}

  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, env, key, value, connection, dataType } = payload ?? {}

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

  if (
    (action === 'insert' || action === 'delete') &&
    !isSupportedDataType(dataType)
  ) {
    return NextResponse.json({ error: 'Unsupported data type' }, { status: 400 })
  }

  try {
    const parsedConnection = parseConnection(connection)
    const client = await getRedisClient(trimmedEnv, parsedConnection ?? undefined)
    const trimmedKey = key.trim()
    const trimmedValue = typeof value === 'string' ? value.trim() : ''

    if (action === 'insert') {
      await insertValue(client, trimmedKey, dataType as SupportedDataType, trimmedValue)
      const result = await readKeyValue(client, trimmedKey)
      return NextResponse.json({ key: trimmedKey, ...result, action: 'inserted' })
    }

    if (action === 'delete') {
      await deleteValue(client, trimmedKey, dataType as SupportedDataType, trimmedValue)
      const result = await readKeyValue(client, trimmedKey)
      return NextResponse.json({ key: trimmedKey, ...result, action: 'deleted' })
    }

    const result = await readKeyValue(client, trimmedKey)
    return NextResponse.json({ key: trimmedKey, ...result, action: 'search' })
  } catch (error) {
    console.error('[redis-control] request failed', error)
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Redis operation failed' }, { status: 500 })
  }
}
