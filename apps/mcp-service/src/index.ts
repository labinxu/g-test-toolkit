import Fastify from 'fastify'

// Types for the incoming spec.json
type Spec = {
  suite: string
  module: string
  userDir?: string
  tags?: string[]
  android?: {
    deviceName?: string
    udid?: string
    apk?: string
    preUninstallPackages?: string[]
    preUninstallOnInstall?: boolean
  }
  cases: Array<{
    title: string
    steps?: string[]
    expects?: string[]
  }>
}

const PORT = Number(process.env.PORT || 3003)

const fastify = Fastify({ logger: true })

// Health check
fastify.get('/health', async () => ({ status: 'ok' }))

// Simple code generator endpoint
fastify.post<{ Body: Spec }>('/generate', async (request, reply) => {
  const spec = request.body

  try {
    const code = generateTest(spec)
    return reply.code(200).send({ ok: true, code })
  } catch (err) {
    request.log.error({ err }, 'Failed to generate code')
    return reply.code(400).send({ ok: false, error: (err as Error).message })
  }
})

// Start server
fastify
  .listen({ port: PORT, host: '0.0.0.0' })
  .then((addr) => fastify.log.info(`MCP service listening on ${addr}`))
  .catch((err) => {
    fastify.log.error(err)
    process.exit(1)
  })

// --- Code generation logic ---
function generateTest(spec: Spec): string {
  if (!spec?.suite || !spec?.module || !Array.isArray(spec?.cases)) {
    throw new Error('Invalid spec: require suite, module, cases')
  }

  const tags = spec.tags?.length ? spec.tags : []
  const android = spec.android || {}

  const header = `describe('${escapeQuote(spec.suite)}', () => {\n  // 直接在 useTestCase.android 传入配置（无需环境变量）\n  const tc = useTestCase({\n    module: '${escapeQuote(spec.module)}',\n    android: {\n      deviceName: '${escapeQuote(android.deviceName || 'pixel6')}',\n      udid: '${escapeQuote(android.udid || 'emulator-5554')}',\n      apk: '${escapeQuote(android.apk || '1.74.5-251104117.apk')}',\n      preUninstallPackages: ${JSON.stringify(android.preUninstallPackages || ['com.gettr.gettr', 'org.app.getter'])},\n      preUninstallOnInstall: ${android.preUninstallOnInstall ?? true},\n    },\n    keepAppOpen: true,\n    shareSession: true,\n    tags: ${JSON.stringify(tags)}, // Traceability: 需求标签\n  })\n\n  beforeAll(async () => {\n    tc.logger?.debug('准备登录场景（示例）')\n    // 示例：确保停留在登录页，可在此做前置操作\n  })\n\n  afterAll(async () => {\n    tc.logger?.debug('清理登录场景（示例）')\n  })\n`

  const cases = spec.cases
    .map((c) => generateCase(c))
    .join('\n')

  const footer = `\n})\n`
  return header + cases + footer
}

function generateCase(c: Spec['cases'][number]): string {
  const title = c.title || '未命名用例'
  const steps = (c.steps || []).map((s) => `    // 步骤：${s}`).join('\n')
  const expects = (c.expects || [])
    .map((e) => `    // 期望：${e}`)
    .join('\n')

  return `\n  it('${escapeQuote(title)}', async () => {\n    // Per-test TestRail overrides (and tags for compatibility)\n    tc.setCaseTestrail?.({\n      template: 'Exploratory Session',\n      type: 'Regression',\n      priority: 'High',\n      section: 'Andr'\n    })\n${steps ? steps + '\n' : ''}${expects ? expects + '\n' : ''}  })\n`
}

function escapeQuote(s: string): string {
  return s.replace(/'/g, "\\'")
}

