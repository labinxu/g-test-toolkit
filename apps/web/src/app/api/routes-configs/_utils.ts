import fs from 'fs'
import path from 'path'

export type RouteItem = {
  source: string
  path: string
  component?: string | null
}

export type RoutesConfigFile = {
  id: string
  name: string
  routes: RouteItem[]
  meta?: {
    createdAt?: string
    updatedAt?: string
  }
}

export type RoutesProjectSummary = {
  id: string
  name: string
  filePath: string
  updatedAt?: string
  routeCount: number
  readOnly?: boolean
}

export function getRepoRoot(): string {
  const appRoot = process.cwd()
  return path.resolve(appRoot, '..', '..')
}

export function getConfigsRoot(): string {
  const repoRoot = getRepoRoot()
  const dir = path.join(repoRoot, 'routes-configs')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function sanitizeId(raw: string | null | undefined): string {
  const base = (raw || '').trim()
  if (!base) return ''
  const lowered = base.toLowerCase()
  const cleaned = lowered.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned
}

export function normalizeRoutesPayload(payload: any): RouteItem[] {
  if (!payload) return []
  const src =
    Array.isArray(payload) && payload.length && typeof payload[0] === 'object' && 'path' in payload[0]
      ? payload
      : Array.isArray(payload?.routes)
      ? payload.routes
      : []

  if (!Array.isArray(src)) return []

  const out: RouteItem[] = []
  for (const r of src) {
    if (!r || typeof r !== 'object') continue
    const pathValue = typeof r.path === 'string' ? r.path : ''
    if (!pathValue) continue
    const source = typeof r.source === 'string' ? r.source : 'unknown'
    const component =
      typeof r.component === 'string' || r.component == null ? (r.component as any) : null
    out.push({ source, path: pathValue, component })
  }
  return out
}

export async function readConfigFile(
  id: string
): Promise<{ file: RoutesConfigFile; filePath: string; mtime: Date; readOnly: boolean }> {
  const repoRoot = getRepoRoot()
  const configsRoot = getConfigsRoot()

  // 1) Preferred location: routes-configs/<id>.json
  const filePath = path.join(configsRoot, `${id}.json`)
  if (fs.existsSync(filePath)) {
    const stat = await fs.promises.stat(filePath)
    const text = await fs.promises.readFile(filePath, 'utf8')
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
    const routes = normalizeRoutesPayload(json && (json.routes || json))
    const name =
      (json && typeof json.name === 'string' && json.name.trim()) || id || 'routes-config'
    const meta = json && typeof json.meta === 'object' ? json.meta : {}
    return {
      file: { id, name, routes, meta },
      filePath: path.relative(repoRoot, filePath),
      mtime: stat.mtime,
      readOnly: false,
    }
  }

  // 2) Legacy fallback for web-fe: root-level web-fe-routes.json
  if (id === 'web-fe') {
    const legacyPath = path.join(repoRoot, 'web-fe-routes.json')
    if (fs.existsSync(legacyPath)) {
      const stat = await fs.promises.stat(legacyPath)
      const text = await fs.promises.readFile(legacyPath, 'utf8')
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
      const routes = normalizeRoutesPayload(json)
      return {
        file: {
          id: 'web-fe',
          name: 'web-fe',
          routes,
          meta: {
            updatedAt: stat.mtime.toISOString(),
          },
        },
        filePath: path.relative(repoRoot, legacyPath),
        mtime: stat.mtime,
        readOnly: true,
      }
    }
    // 如果 legacy 文件不存在，则返回一个空的只读配置，而不是 404，
    // 以避免前端在选择 web-fe 项目时直接报错。
    const now = new Date()
    return {
      file: {
        id: 'web-fe',
        name: 'web-fe',
        routes: [],
        meta: {
          updatedAt: now.toISOString(),
        },
      },
      filePath: 'web-fe-routes.json',
      mtime: now,
      readOnly: true,
    }
  }

  throw new Error(`Routes config "${id}" not found`)
}

export async function listProjects(): Promise<RoutesProjectSummary[]> {
  const repoRoot = getRepoRoot()
  const configsRoot = getConfigsRoot()
  const out: RoutesProjectSummary[] = []
  const seenIds = new Set<string>()

  try {
    const entries = await fs.promises.readdir(configsRoot)
    for (const name of entries) {
      if (!name.endsWith('.json')) continue
      const id = name.replace(/\.json$/, '')
      const full = path.join(configsRoot, name)
      try {
        const stat = await fs.promises.stat(full)
        const text = await fs.promises.readFile(full, 'utf8')
        let json: any
        try {
          json = JSON.parse(text)
        } catch {
          json = null
        }
        const routes = normalizeRoutesPayload(json && (json.routes || json))
        const routeCount = routes.length
        const friendlyName =
          (json && typeof json.name === 'string' && json.name.trim()) || id || 'routes-config'
        out.push({
          id,
          name: friendlyName,
          filePath: path.relative(repoRoot, full),
          updatedAt: stat.mtime.toISOString(),
          routeCount,
          readOnly: false,
        })
        seenIds.add(id)
      } catch {
        // ignore broken files
      }
    }
  } catch {
    // ignore if dir cannot be read
  }

  // Legacy web-fe project from root-level web-fe-routes.json
  try {
    if (!seenIds.has('web-fe')) {
      const legacyPath = path.join(repoRoot, 'web-fe-routes.json')
      if (fs.existsSync(legacyPath)) {
        const stat = await fs.promises.stat(legacyPath)
        const text = await fs.promises.readFile(legacyPath, 'utf8')
        let json: any
        try {
          json = JSON.parse(text)
        } catch {
          json = null
        }
        const routes = normalizeRoutesPayload(json)
        out.push({
          id: 'web-fe',
          name: 'web-fe (legacy)',
          filePath: path.relative(repoRoot, legacyPath),
          updatedAt: stat.mtime.toISOString(),
          routeCount: routes.length,
          readOnly: true,
        })
      }
    }
  } catch {
    // ignore legacy errors
  }

  // Sort by id for stable output
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

export async function saveConfigFile(params: {
  id: string
  name?: string | null
  routes: RouteItem[]
  overwrite?: boolean
}): Promise<{ filePath: string; routeCount: number }> {
  const { id, routes, overwrite } = params
  const name = (params.name || id || 'routes-config').trim()
  if (!id) {
    throw new Error('id is required')
  }

  const configsRoot = getConfigsRoot()
  const filePath = path.join(configsRoot, `${id}.json`)
  const exists = fs.existsSync(filePath)

  if (exists && !overwrite) {
    throw Object.assign(new Error(`Config "${id}" already exists`), { code: 'E_EXISTS' })
  }

  const now = new Date().toISOString()
  let createdAt = now
  if (exists) {
    try {
      const text = await fs.promises.readFile(filePath, 'utf8')
      const json = JSON.parse(text)
      if (json?.meta?.createdAt) {
        createdAt = String(json.meta.createdAt)
      }
    } catch {
      // ignore, keep now
    }
  }

  const json: RoutesConfigFile = {
    id,
    name,
    routes: routes || [],
    meta: {
      createdAt,
      updatedAt: now,
    },
  }

  await fs.promises.writeFile(filePath, JSON.stringify(json, null, 2), 'utf8')

  return {
    filePath,
    routeCount: routes.length,
  }
}

export async function deleteConfigFile(id: string): Promise<{ deleted: boolean; reason?: string }> {
  const configsRoot = getConfigsRoot()
  const filePath = path.join(configsRoot, `${id}.json`)
  if (!fs.existsSync(filePath)) {
    return { deleted: false, reason: 'not_found' }
  }
  await fs.promises.unlink(filePath)
  return { deleted: true }
}
