import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import fs from 'fs'
import path from 'path'
import * as esbuild from 'esbuild'
import { Requirement } from './entities/requirement.entity'
import { ReqTestMap } from './entities/req-test-map.entity'

type AnyRec = Record<string, any>

export type TestRef = {
  testId: string
  name: string
  suitePath: string[]
  module?: string
}

@Injectable()
export class TraceabilityService {
  constructor(
    @InjectRepository(Requirement)
    private readonly reqRepo: Repository<Requirement>,
    @InjectRepository(ReqTestMap)
    private readonly mapRepo: Repository<ReqTestMap>
  ) {}

  async upsertRequirements(
    items: Array<{
      key: string
      system?: string
      title?: string
      url?: string
    }>
  ) {
    const results: Requirement[] = []
    for (const item of items) {
      if (!item?.key) continue
      const key = String(item.key).trim()
      let existing = await this.reqRepo.findOne({ where: { key } })
      if (!existing) {
        existing = this.reqRepo.create({
          key,
          system: item.system || 'jira',
          title: item.title,
          url: item.url,
        })
      } else {
        existing.system = item.system || existing.system
        existing.title = item.title ?? existing.title
        existing.url = item.url ?? existing.url
      }
      results.push(await this.reqRepo.save(existing))
    }
    return results
  }

  async listRequirements() {
    return await this.reqRepo.find({ order: { key: 'ASC' } })
  }

  async saveMappings(
    mappings: Array<{
      requirementKey: string
      testId: string
      linkType?: string
      note?: string
    }>
  ) {
    const out: ReqTestMap[] = []
    for (const m of mappings) {
      const requirementKey = String(m.requirementKey || '').trim()
      const testId = String(m.testId || '').trim()
      if (!requirementKey || !testId) continue
      let existing = await this.mapRepo.findOne({
        where: { requirementKey, testId },
      })
      if (!existing) {
        existing = this.mapRepo.create({ requirementKey, testId })
      }
      existing.linkType = m.linkType || existing.linkType || 'tests'
      existing.note = m.note ?? existing.note
      out.push(await this.mapRepo.save(existing))
    }
    return out
  }

  async listMappings() {
    return await this.mapRepo.find({ order: { requirementKey: 'ASC' } })
  }

  // Read test metadata from latest report meta JSON files per user
  async listTestsFromReports(user?: string): Promise<TestRef[]> {
    const usersRoot = process.env.USERS_DIR
      ? path.resolve(process.cwd(), process.env.USERS_DIR)
      : path.resolve(process.cwd(), 'workspace/users')
    const targetUsers: string[] = []
    if (user) {
      targetUsers.push(user)
    } else {
      try {
        const dirs = fs.readdirSync(usersRoot, { withFileTypes: true })
        for (const d of dirs) if (d.isDirectory()) targetUsers.push(d.name)
      } catch {}
    }
    const tests = new Map<string, TestRef>()
    for (const u of targetUsers) {
      const reportsDir = path.join(usersRoot, u, 'reports')
      let files: string[] = []
      try {
        files = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.json'))
      } catch {
        continue
      }
      // read up to last 50 files to avoid over-reading
      files.sort()
      const pick = files.slice(-50)
      for (const f of pick) {
        const full = path.join(reportsDir, f)
        try {
          const raw = fs.readFileSync(full, 'utf-8')
          const data = JSON.parse(raw) as AnyRec
          const cases: AnyRec[] = Array.isArray(data?.cases) ? data.cases : []
          for (const c of cases) {
            const testId = String(c?.name || '').trim() || this.buildTestId(c)
            if (!testId) continue
            const suitePath: string[] = Array.isArray(c?.metadata?.suitePath)
              ? c.metadata.suitePath
              : []
            const name = String(c?.metadata?.testTitle || testId.split('›').pop() || testId).trim()
            const entry: TestRef = {
              testId,
              name,
              suitePath,
              module: c?.metadata?.module,
            }
            if (!tests.has(testId)) tests.set(testId, entry)
          }
        } catch {}
      }
    }
    return Array.from(tests.values()).sort((a, b) => a.testId.localeCompare(b.testId))
  }

  private resolveCoreLib() {
    const coreDir = path.join(
      __dirname,
      '..',
      '..',
      process.env.CORE_LIB_DIR || 'workspace/shared-libs/core'
    )
    const mjs = path.join(coreDir, 'dist/index.mjs')
    const js = path.join(coreDir, 'dist/index.js')
    const file = fs.existsSync(mjs) ? mjs : js
    if (!fs.existsSync(file)) {
      throw new Error(`core-lib dist not found at ${file}`)
    }
    // Use Node require for .js; for .mjs use dynamic import via require('node:module')? Simpler: prefer CJS path
    // Our core dist ships both index.js and index.mjs; choose js when present
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(js)
    return mod?.default || mod
  }

  private async transformTsToCjs(code: string) {
    const result = await esbuild.transform(code, {
      loader: 'ts',
      format: 'cjs',
      platform: 'node',
      sourcemap: false,
      target: 'esnext',
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    } as esbuild.TransformOptions)
    return result.code
  }

  private createStubModule(): any {
    const klass = class {}
    return new Proxy(
      {},
      {
        get: (_t, _p) => klass,
      }
    )
  }

  private async evaluateFileForDiscovery(fullPath: string, coreLib: any) {
    const raw = fs.readFileSync(fullPath, 'utf-8')
    const transpiled = await this.transformTsToCjs(raw)
    const vm = await import('vm')
    const sandbox: any = {
      require: (name: string) => {
        // Map common aliases used by legacy tests to core-lib to improve static discovery
        if (name === 'core-lib' || name === 'test-case') return coreLib
        if (
          name === 'gettr-lib' ||
          name === 'gettr-android-lib' ||
          name === 'testcase-common'
        )
          return this.createStubModule()
        return require(name)
      },
      module: { exports: {} },
      exports: {},
      console,
    }
    const context = vm.createContext(sandbox)
    const script = new vm.Script(transpiled, { filename: fullPath })
    script.runInContext(context)
  }

  private walkDir(dir: string, exts = ['.ts']): string[] {
    const out: string[] = []
    const st = (() => {
      try {
        return fs.statSync(dir)
      } catch {
        return null
      }
    })()
    if (!st || !st.isDirectory()) return out
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) out.push(...this.walkDir(p, exts))
      else if (exts.includes(path.extname(e.name))) out.push(p)
    }
    return out
  }

  async listTestsStatic(user?: string): Promise<TestRef[]> {
    const usersRoot = process.env.USERS_DIR
      ? path.resolve(process.cwd(), process.env.USERS_DIR)
      : path.resolve(process.cwd(), 'workspace/users')
    const targetUsers: string[] = []
    if (user) targetUsers.push(user)
    else {
      try {
        const dirs = fs.readdirSync(usersRoot, { withFileTypes: true })
        for (const d of dirs) if (d.isDirectory()) targetUsers.push(d.name)
      } catch {}
    }
    const coreLib = this.resolveCoreLib()
    const results = new Map<string, TestRef>()
    for (const u of targetUsers) {
      const casesDir = path.join(usersRoot, u, 'cases')
      const files = this.walkDir(casesDir, ['.ts'])
      for (const f of files) {
        try {
          coreLib.clearBddSuites?.()
          if (Array.isArray(coreLib.__testCaseClasses)) coreLib.__testCaseClasses.length = 0
          await this.evaluateFileForDiscovery(f, coreLib)
          // Collect BDD
          const roots = coreLib.getBddRootSuites?.() || []
          const collectBdd = (suite: any, chain: string[]) => {
            const pathNow = [...chain, suite.title].filter(Boolean)
            for (const t of suite.tests || []) {
              if (t.skip) continue
              const testId = [...pathNow, t.title].join(' › ')
              const entry: TestRef = {
                testId,
                name: t.title,
                suitePath: pathNow,
              }
              if (!results.has(testId)) results.set(testId, entry)
            }
            for (const child of suite.suites || []) collectBdd(child, pathNow)
          }
          for (const r of roots) collectBdd(r, [])
          // Collect decorator-based classes
          const classes: any[] = Array.isArray(coreLib.__testCaseClasses)
            ? coreLib.__testCaseClasses.slice()
            : []
          for (const Ctor of classes) {
            const proto = Ctor?.prototype || {}
            const methods = Object.getOwnPropertyNames(proto)
            for (const m of methods) {
              if (m && m.startsWith('test') && typeof proto[m] === 'function') {
                const testId = `${Ctor.name}.${m}`
                const entry: TestRef = {
                  testId,
                  name: m,
                  suitePath: [Ctor.name],
                }
                if (!results.has(testId)) results.set(testId, entry)
              }
            }
          }
        } catch (err) {
          // Swallow errors per-file to keep discovery robust
          // console.warn(`discovery failed for ${f}: ${err}`)
        } finally {
          try {
            coreLib.clearBddSuites?.()
          } catch {}
          try {
            if (Array.isArray(coreLib.__testCaseClasses)) coreLib.__testCaseClasses.length = 0
          } catch {}
        }
      }
    }
    return Array.from(results.values()).sort((a, b) => a.testId.localeCompare(b.testId))
  }

  async listTestsCombined(user?: string): Promise<TestRef[]> {
    const staticTests = await this.listTestsStatic(user)
    const executed = await this.listTestsFromReports(user)
    const byId = new Map<string, TestRef>()
    for (const t of [...staticTests, ...executed]) {
      if (!byId.has(t.testId)) byId.set(t.testId, t)
    }
    return Array.from(byId.values()).sort((a, b) => a.testId.localeCompare(b.testId))
  }

  async listWorkspaceUsers(): Promise<string[]> {
    const usersRoot = process.env.USERS_DIR
      ? path.resolve(process.cwd(), process.env.USERS_DIR)
      : path.resolve(process.cwd(), 'apps/api/workspace/users')
    try {
      const entries = fs.readdirSync(usersRoot, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    } catch {
      return []
    }
  }

  private buildTestId(c: AnyRec): string {
    const suitePath: string[] = Array.isArray(c?.metadata?.suitePath) ? c.metadata.suitePath : []
    const testTitle = String(c?.metadata?.testTitle || '').trim()
    const pathPart = suitePath.join(' › ')
    return [pathPart, testTitle].filter(Boolean).join(' › ')
  }

  async export(
    format: 'testrail-cases' | 'testrail-refs' | 'xray' | 'jira-links',
    user?: string,
    options?: {
      projectKey?: string
      labels?: string[]
      requirementKeys?: string[]
      testIds?: string[]
      testrail?: {
        section?: string
        useFirstSuite?: boolean
        template?: string
        type?: string
        priority?: string
      }
    }
  ) {
    if (format === 'testrail-cases') {
      // use combined source so non-executed tests can be exported too
      const tests = await this.listTestsCombined(user)
      const maps = await this.listMappings()
      // Gather per-test overrides from latest executed reports (template/type/priority/section)
      const overrides = await this.gatherTestrailOverrides(user)
      // Aggregate requirement keys per testId
      const refsByTest = new Map<string, string[]>()
      for (const m of maps) {
        if (!refsByTest.has(m.testId)) refsByTest.set(m.testId, [])
        const arr = refsByTest.get(m.testId)!
        if (!arr.includes(m.requirementKey)) arr.push(m.requirementKey)
      }
      const filterReq = Array.isArray(options?.requirementKeys) && options!.requirementKeys!.length
        ? new Set(options!.requirementKeys!.map((s) => String(s)))
        : null
      const filterTests = Array.isArray(options?.testIds) && options!.testIds!.length
        ? new Set(options!.testIds!.map((s) => String(s)))
        : null
      const rows: string[] = []
      const header = ['Section', 'Title', 'Template', 'Type', 'Priority', 'References']
      rows.push(header.join(','))
      for (const t of tests) {
        const refs = (refsByTest.get(t.testId) || []).join(';')
        if (filterReq && !refs.split(';').some((r) => filterReq.has(r))) continue
        if (filterTests && !filterTests.has(t.testId)) continue
        const ov = overrides.get(t.testId) || {}
        const sectionBase = options?.testrail?.useFirstSuite
          ? (t.suitePath?.[0] || undefined)
          : (options?.testrail?.section || t.suitePath?.[0] || undefined)
        const section = String(ov.section || sectionBase || options?.testrail?.section || 'Root')
        const title = t.name || t.testId
        const tpl = String(ov.template || options?.testrail?.template || 'Test Case')
        const type = String(ov.type || options?.testrail?.type || 'Functional')
        const prio = String(ov.priority || options?.testrail?.priority || 'Medium')
        // Escape commas/quotes in CSV fields
        const esc = (v: string) => '"' + String(v ?? '').replaceAll('"', '""') + '"'
        rows.push([section, title, tpl, type, prio, refs].map(esc).join(','))
      }
      const csv = rows.join('\n')
      return {
        contentType: 'text/csv; charset=utf-8',
        body: csv,
        filename: 'testrail-cases.csv',
      }
    }
    if (format === 'xray') {
      const tests = await this.listTestsFromReports(user)
      const maps = await this.listMappings()
      const mapByTest = new Map<string, string[]>()
      for (const m of maps) {
        if (!mapByTest.has(m.testId)) mapByTest.set(m.testId, [])
        const arr = mapByTest.get(m.testId)!
        if (!arr.includes(m.requirementKey)) arr.push(m.requirementKey)
      }
      const filterReq = Array.isArray(options?.requirementKeys) && options!.requirementKeys!.length
        ? new Set(options!.requirementKeys!.map((s) => String(s)))
        : null
      const filterTests = Array.isArray(options?.testIds) && options!.testIds!.length
        ? new Set(options!.testIds!.map((s) => String(s)))
        : null
      const projectKey = options?.projectKey || process.env.XRAY_PROJECT_KEY || ''
      const out: AnyRec = { tests: [] as AnyRec[] }
      for (const t of tests) {
        const reqs = mapByTest.get(t.testId) || []
        if (filterReq && !reqs.some((r) => filterReq.has(r))) continue
        if (filterTests && !filterTests.has(t.testId)) continue
        if (!reqs.length) continue // only export mapped tests
        out.tests.push({
          testInfo: {
            projectKey: projectKey || undefined,
            summary: t.testId,
            labels:
              options?.labels && options.labels.length
                ? options.labels
                : [t.module].filter(Boolean),
            testType: 'Manual',
            requirementKeys: reqs,
          },
          steps: [],
        })
      }
      return {
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(out, null, 2),
        filename: 'xray-import.json',
      }
    }
    // Minimal stub for other formats
    return {
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unsupported format' }),
      filename: 'export.json',
    }
  }

  private parseRequirementTags(tags: unknown): Array<{ key: string; system: string }> {
    const out: Array<{ key: string; system: string }> = []
    const arr: string[] = Array.isArray(tags) ? (tags as any[]).map(String) : []
    for (const raw of arr) {
      const m = /^REQ:([A-Z]+):(.+)$/.exec(raw.trim())
      if (!m) continue
      const system = m[1].toUpperCase()
      const key = m[2].trim()
      if (system && key) out.push({ key, system })
    }
    return out
  }

  private extractTestrailOverridesFromCase(c: AnyRec): {
    template?: string
    type?: string
    priority?: string
    section?: string
  } {
    const out: AnyRec = {}
    const meta = c?.metadata || {}
    const tr = meta?.testrail || {}
    if (typeof tr?.template === 'string' && tr.template.trim()) out.template = tr.template.trim()
    if (typeof tr?.type === 'string' && tr.type.trim()) out.type = tr.type.trim()
    if (typeof tr?.priority === 'string' && tr.priority.trim()) out.priority = tr.priority.trim()
    if (typeof tr?.section === 'string' && tr.section.trim()) out.section = tr.section.trim()
    // Fallback to tags parsing: TR:TPL:..., TR:TYPE:..., TR:PRIO:..., TR:SEC:...
    const arr: string[] = Array.isArray(meta?.tags) ? (meta.tags as any[]).map(String) : []
    for (const raw of arr) {
      const s = raw.trim()
      let m = /^TR:(?:TPL|TEMPLATE):(.+)$/.exec(s)
      if (m && m[1]) out.template = m[1].trim()
      m = /^TR:(?:TYPE):(.+)$/.exec(s)
      if (m && m[1]) out.type = m[1].trim()
      m = /^TR:(?:PRIO|PRIORITY):(.+)$/.exec(s)
      if (m && m[1]) out.priority = m[1].trim()
      m = /^TR:(?:SEC|SECTION):(.+)$/.exec(s)
      if (m && m[1]) out.section = m[1].trim()
    }
    return out
  }

  private async gatherTestrailOverrides(user?: string): Promise<Map<string, {
    template?: string
    type?: string
    priority?: string
    section?: string
  }>> {
    const usersRoot = process.env.USERS_DIR
      ? path.resolve(process.cwd(), process.env.USERS_DIR)
      : path.resolve(process.cwd(), 'workspace/users')
    const targetUsers: string[] = []
    if (user) targetUsers.push(user)
    else {
      try {
        const dirs = fs.readdirSync(usersRoot, { withFileTypes: true })
        for (const d of dirs) if (d.isDirectory()) targetUsers.push(d.name)
      } catch {}
    }
    const byId = new Map<string, { template?: string; type?: string; priority?: string; section?: string }>()
    for (const u of targetUsers) {
      const reportsDir = path.join(usersRoot, u, 'reports')
      let files: string[] = []
      try {
        files = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.json'))
      } catch {
        continue
      }
      files.sort()
      const pick = files.slice(-50)
      for (const f of pick) {
        const full = path.join(reportsDir, f)
        try {
          const raw = fs.readFileSync(full, 'utf-8')
          const data = JSON.parse(raw) as AnyRec
          const cases: AnyRec[] = Array.isArray(data?.cases) ? data.cases : []
          for (const c of cases) {
            const testId = String(c?.name || '').trim() || this.buildTestId(c)
            if (!testId) continue
            const ov = this.extractTestrailOverridesFromCase(c)
            if (ov && (ov.template || ov.type || ov.priority || ov.section)) byId.set(testId, ov)
          }
        } catch {}
      }
    }
    return byId
  }

  async suggestMappings(user?: string) {
    const usersRoot = process.env.USERS_DIR
      ? path.resolve(process.cwd(), process.env.USERS_DIR)
      : path.resolve(process.cwd(), 'workspace/users')
    const targetUsers: string[] = []
    if (user) targetUsers.push(user)
    else {
      try {
        const dirs = fs.readdirSync(usersRoot, { withFileTypes: true })
        for (const d of dirs) if (d.isDirectory()) targetUsers.push(d.name)
      } catch {}
    }
    const testsById = new Map<string, TestRef>()
    const reqs = new Map<string, { key: string; system: string }>()
    const mappings: Array<{ requirementKey: string; testId: string }> = []
    for (const u of targetUsers) {
      const reportsDir = path.join(usersRoot, u, 'reports')
      let files: string[] = []
      try {
        files = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.json'))
      } catch {
        continue
      }
      files.sort()
      const pick = files.slice(-50)
      for (const f of pick) {
        const full = path.join(reportsDir, f)
        try {
          const data = JSON.parse(fs.readFileSync(full, 'utf-8')) as AnyRec
          const cases: AnyRec[] = Array.isArray(data?.cases) ? data.cases : []
          for (const c of cases) {
            const testId = String(c?.name || '').trim() || this.buildTestId(c)
            if (!testId) continue
            const suitePath: string[] = Array.isArray(c?.metadata?.suitePath)
              ? c.metadata.suitePath
              : []
            const name = String(c?.metadata?.testTitle || testId.split('›').pop() || testId).trim()
            const tr: TestRef = {
              testId,
              name,
              suitePath,
              module: c?.metadata?.module,
            }
            testsById.set(testId, tr)
            const pairs = this.parseRequirementTags(c?.metadata?.tags)
            for (const p of pairs) {
              const reqKey = p.key
              reqs.set(reqKey, { key: reqKey, system: p.system.toLowerCase() })
              mappings.push({ requirementKey: reqKey, testId })
            }
          }
        } catch {}
      }
    }
    // unique mappings
    const unique = new Map<string, { requirementKey: string; testId: string }>()
    for (const m of mappings) unique.set(`${m.requirementKey}@@${m.testId}`, m)
    return {
      requirements: Array.from(reqs.values()).sort((a, b) => a.key.localeCompare(b.key)),
      mappings: Array.from(unique.values()),
      tests: Array.from(testsById.values()),
    }
  }

  async applySuggestions(user?: string) {
    const sugg = await this.suggestMappings(user)
    await this.upsertRequirements(sugg.requirements)
    await this.saveMappings(sugg.mappings)
    return {
      savedRequirements: sugg.requirements.length,
      savedMappings: sugg.mappings.length,
    }
  }

  async deleteMappings(input: {
    ids?: number[]
    mappings?: Array<{ requirementKey: string; testId: string }>
  }) {
    let deleted = 0
    const ids = Array.isArray(input?.ids)
      ? input!.ids!.filter((x) => Number.isFinite(x as any))
      : []
    if (ids.length) {
      const res = await this.mapRepo.delete(ids as any)
      deleted += res?.affected || 0
    }
    const pairs = Array.isArray(input?.mappings) ? input!.mappings! : []
    for (const m of pairs) {
      const requirementKey = String(m?.requirementKey || '').trim()
      const testId = String(m?.testId || '').trim()
      if (!requirementKey || !testId) continue
      const res = await this.mapRepo.delete({ requirementKey, testId } as any)
      deleted += res?.affected || 0
    }
    return { deleted }
  }
}
