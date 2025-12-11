import { Injectable } from '@nestjs/common'
import { SettingsService } from '../settings/settings.service'

type Bounds = { x1: number; y1: number; x2: number; y2: number }
type NodeInfo = {
  nodeId: string
  class: string
  text: string
  resourceId: string
  contentDesc: string
  clickable: boolean
  bounds: Bounds
}

type Snapshot = {
  screenshotBase64?: string
  screenshotUrl?: string
  screen: { width: number; height: number }
  nodes: NodeInfo[]
  takenAt: number
}

@Injectable()
export class AiService {
  constructor(private readonly settings: SettingsService) {}
  // ---- LLM config helpers ----
  private async getConfig(userId?: number) {
    // Prefer DB settings; fallback to env
    const aiCfg = await this.settings.getAiConfig(userId).catch(() => ({
      provider: '',
      model: '',
      baseUrl: '',
      apiKey: '' as any,
      timeoutMs: null,
      maxTokens: null,
    }))
    const provider = (aiCfg.provider || process.env.AI_PROVIDER || 'openai').toLowerCase()
    const isGrok = provider === 'grok'
    // For openai/custom: model is OpenAI model; For azure: model maps to deployment name
    const model = aiCfg.model || process.env.AI_MODEL || 'gpt-4o-mini'
    const baseUrl = aiCfg.baseUrl || process.env.AI_BASE_URL || ''
    const openaiApiKey = (
      aiCfg.apiKey ||
      (isGrok
        ? process.env.GROK_API_KEY ||
          process.env.XAI_API_KEY ||
          process.env.AI_API_KEY ||
          process.env.OPENAI_API_KEY ||
          ''
        : process.env.OPENAI_API_KEY ||
          process.env.AI_API_KEY ||
          process.env.GROK_API_KEY ||
          process.env.XAI_API_KEY ||
          '')
    ).toString()
    const azure = {
      endpoint: (aiCfg.baseUrl || process.env.AZURE_OPENAI_ENDPOINT || '').toString(),
      apiKey: (aiCfg.apiKey || process.env.AZURE_OPENAI_API_KEY || '').toString(),
      deployment: (aiCfg.model || process.env.AZURE_OPENAI_DEPLOYMENT || '').toString(),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview',
    }
    const envTimeout = Number(process.env.AI_TIMEOUT_MS ?? 0)
    let timeoutMs = 10000
    if (aiCfg.timeoutMs != null) {
      if (aiCfg.timeoutMs <= 0) timeoutMs = 0
      else timeoutMs = Math.max(1000, Math.min(600000, aiCfg.timeoutMs))
    } else if (Number.isFinite(envTimeout)) {
      timeoutMs = envTimeout <= 0 ? 0 : Math.max(1000, Math.min(600000, envTimeout))
    }
    const maxTokensCandidate =
      (aiCfg as any).maxTokens ??
      Number(process.env.AI_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS || 0)
    const maxTokens = Math.max(64, Math.min(512000, Number(maxTokensCandidate) || 512))
    return {
      provider,
      model,
      baseUrl,
      openaiApiKey,
      azure,
      timeoutMs,
      maxTokens,
    }
  }

  async isLLMConfigured(userId?: number): Promise<boolean> {
    const { provider, openaiApiKey, baseUrl, azure } = await this.getConfig(userId)
    console.log('isLLMConfigured', provider, baseUrl, azure)
    if (provider === 'openai') return !!openaiApiKey
    if (provider === 'grok') return !!openaiApiKey
    if (provider === 'azure') return !!(azure.endpoint && azure.apiKey && azure.deployment)
    // custom/OpenAI-compatible: require either baseUrl+key or openaiApiKey
    return !!(baseUrl && (openaiApiKey || process.env.AI_API_KEY))
  }

  private escapeQuote(s: string) {
    return (s ?? '').replace(/[\\']/g, (m) => `\\${m}`)
  }

  private isInputClass(n: NodeInfo): boolean {
    const cls = (n.class || '').toLowerCase()
    return (
      cls.includes('edittext') ||
      cls.includes('textinput') ||
      cls.includes('textfield') ||
      cls.includes('autocomplete') ||
      cls.includes('search')
    )
  }

  private bestSelector(n: NodeInfo): string {
    if (n.contentDesc) return `~${this.escapeQuote(n.contentDesc)}`
    if (n.resourceId) {
      const rid = n.resourceId || ''
      const hasFull = /[:/]/.test(rid)
      if (hasFull) {
        return `android=new UiSelector().resourceId(\"${rid.replace(/\\"/g, '\\\\"')}\")`
      }
      return `android=new UiSelector().resourceIdMatches(\".*${rid.replace(/\\"/g, '\\\\"')}\")`
    }
    if (n.text)
      return `android=new UiSelector().text(\"${(n.text || '').replace(/\\"/g, '\\\\"')}\")`
    // Fallback xpath using class + attributes
    const parts: string[] = []
    if (n.class) parts.push(n.class)
    if (n.text) parts.push(`@text=\"${(n.text || '').replace(/\\"/g, '\\\\"')}\"`)
    if (n.resourceId) parts.push(`@resource-id=\"${n.resourceId}\"`)
    const xpath =
      parts.length > 1 ? `//${parts[0]}[${parts.slice(1).join(' and ')}]` : `//${parts[0] || '*'}`
    return xpath
  }

  private parseIntent(prompt: string) {
    const p = (prompt || '').toLowerCase()
    const isLongPress = /长按|long\s*press/.test(p)
    const isInput = /输入|set\s*value|type/.test(p) && !isLongPress
    const isClick = !isInput && !isLongPress // default

    // try extract text inside quotes
    let inputText = ''
    const m1 = prompt.match(/['\"]([^'\"]{1,200})['\"]/)
    if (m1) inputText = m1[1]
    if (!inputText) {
      // simple zh heuristic: after "输入"
      const m2 = prompt.match(/输入([\u4e00-\u9fa5\w\s\-_.]{1,40})/)
      if (m2) inputText = m2[1].trim()
    }
    const longPressMs = (() => {
      const m = prompt.match(/(\d{2,4})\s*ms|长按\s*(\d{2,4})/i)
      const n = m ? parseInt(m[1] || m[2] || '800', 10) : 800
      return Math.max(200, Math.min(3000, n || 800))
    })()
    return { isClick, isInput, isLongPress, inputText, longPressMs }
  }

  private findTargetNode(
    snapshot: Snapshot,
    prompt: string,
    focusNodeId?: string | null
  ): NodeInfo | null {
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : []
    if (focusNodeId) {
      const found = nodes.find((n) => n.nodeId === focusNodeId)
      if (found) return found
    }
    const hints: string[] = []
    // collect quoted hints or words around known verbs
    const qm = prompt.match(/['\"]([^'\"]{1,200})['\"]/)
    if (qm) hints.push(qm[1].toLowerCase())
    const zh = prompt.match(/[\u4e00-\u9fa5]{2,8}/g) || []
    hints.push(...zh.map((s) => s.toLowerCase()))

    const score = (n: NodeInfo): number => {
      let s = 0
      const area = Math.max(1, (n.bounds.x2 - n.bounds.x1) * (n.bounds.y2 - n.bounds.y1))
      s += Math.min(50, Math.round(Math.log10(area + 10) * 10))
      if (n.clickable) s += 10
      const txt = (n.text || '').toLowerCase()
      const desc = (n.contentDesc || '').toLowerCase()
      const rid = (n.resourceId || '').toLowerCase()
      for (const h of hints) {
        if (!h) continue
        if (txt.includes(h)) s += 40
        if (desc.includes(h)) s += 35
        if (rid.includes(h)) s += 30
      }
      return s
    }

    let candidates = nodes
    // prefer clickable when intent is click/long-press
    const p = prompt.toLowerCase()
    if (/点击|click|tap|长按|press/.test(p)) {
      candidates = nodes.filter((n) => n.clickable) as any
      if (candidates.length === 0) candidates = nodes
    }
    if (candidates.length === 0) return null
    return candidates.slice().sort((a, b) => score(b) - score(a))[0] || null
  }

  generateFromRules(input: { snapshot: Snapshot; prompt: string; focusNodeId?: string | null }): {
    snippet: string
    usedSelector?: string
  } {
    const { snapshot, prompt, focusNodeId } = input
    const intent = this.parseIntent(prompt || '')
    const node = this.findTargetNode(snapshot, prompt || '', focusNodeId || undefined)
    if (!node) {
      return { snippet: `// Unable to infer element from snapshot` }
    }
    const sel = this.bestSelector(node)
    if (intent.isLongPress) {
      const ms = intent.longPressMs
      const snippet = `await (await this.page.$('${sel}')).touchAction({ action: 'longPress', duration: ${ms} })`
      return { snippet, usedSelector: sel }
    }
    if (intent.isInput || this.isInputClass(node)) {
      const text = intent.inputText || 'your text'
      const esc = this.escapeQuote(text)
      const snippet = [
        `const el = await this.page.$('${sel}')`,
        `await el.click()`,
        `await el.setValue('${esc}')`,
      ].join('\n')
      return { snippet, usedSelector: sel }
    }
    // default click
    const snippet = `await this.page.$('${sel}').click()`
    return { snippet, usedSelector: sel }
  }

  // ---- LLM integration ----
  private summarizeNode(n: NodeInfo) {
    return {
      class: n.class || '',
      text: (n.text || '').slice(0, 80),
      resourceId: (n.resourceId || '').slice(0, 120),
      contentDesc: (n.contentDesc || '').slice(0, 120),
      clickable: !!n.clickable,
      bounds: n.bounds,
    }
  }

  private rankNodes(nodes: NodeInfo[], focusId?: string | null) {
    const S = (n: NodeInfo) => {
      let s = 0
      const area = Math.max(1, (n.bounds.x2 - n.bounds.x1) * (n.bounds.y2 - n.bounds.y1))
      const areaScore = Math.min(30, Math.round(Math.log10(area + 10) * 8))
      s += areaScore
      if (n.clickable) s += 20
      if (n.contentDesc) s += 20
      if (n.resourceId) s += 12
      if (n.text) s += 10
      if (focusId && n.nodeId === focusId) s += 1000
      return s
    }
    return nodes.slice().sort((a, b) => S(b) - S(a))
  }

  private buildPrompt(input: {
    snapshot: Snapshot
    userPrompt: string
    focusNodeId?: string | null
  }) {
    const { snapshot, userPrompt, focusNodeId } = input
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : []
    // Only keep actionable nodes to reduce noise for the LLM
    let nodePool = nodes.filter((n) => n.clickable || this.isInputClass(n))
    if (nodePool.length === 0) nodePool = nodes
    if (focusNodeId && nodePool.every((n) => n.nodeId !== focusNodeId)) {
      const focus = nodes.find((n) => n.nodeId === focusNodeId)
      if (focus) nodePool = [focus, ...nodePool]
    }
    const ranked = this.rankNodes(nodePool, focusNodeId)
    const trimmed = ranked.slice(0, 120).map((n) => this.summarizeNode(n))
    const selected = focusNodeId ? nodes.find((n) => n.nodeId === focusNodeId) : null
    const selectedBrief = selected
      ? {
          class: selected.class,
          text: (selected.text || '').slice(0, 80),
          resourceId: (selected.resourceId || '').slice(0, 120),
          contentDesc: (selected.contentDesc || '').slice(0, 120),
          clickable: !!selected.clickable,
          bounds: selected.bounds,
        }
      : null

    const system = [
      '你是自动化脚本生成器。只输出可直接粘贴的 TypeScript 代码，不要解释、注释或多余文本。',
      '使用 WebdriverIO 风格 API：await this.page.$(selector).click()；对输入框使用 setValue。',
      '选择器优先级：~content-desc（accessibility id） > UiSelector(resourceId/resourceIdMatches) > UiSelector(text) > XPath（最后手段）。',
      '不要引入新的 import，不要创建类/函数。',
    ].join('\n')

    const fewShots = [
      {
        ask: '点击“登录”按钮',
        code: "await this.page.$('~登录').click()",
      },
      {
        ask: '在用户名输入框输入 test_user',
        code: [
          "const el = await this.page.$('android=new UiSelector().resourceId(\\\"com.example:id/username\\\")')",
          'await el.click()',
          "await el.setValue('test_user')",
        ].join('\n'),
      },
      {
        ask: '长按“更多”800ms',
        code: "await (await this.page.$('android=new UiSelector().text(\"更多\")')).touchAction({ action: 'longPress', duration: 800 })",
      },
    ]
    const fewShotBlock = fewShots.map((x) => `任务: ${x.ask}\n代码:\n${x.code}`).join('\n\n')

    const user = [
      `Task: ${userPrompt}`,
      selectedBrief ? `Selected: ${JSON.stringify(selectedBrief)}` : '',
      'Constraints: 只返回代码，无需说明；遵循选择器优先级；不要额外 import。',
      'Nodes (top-ranked, JSON):',
      JSON.stringify(trimmed),
      '',
      '参考示例：',
      fewShotBlock,
    ]
      .filter(Boolean)
      .join('\n')

    return { system, user }
  }

  private async callLLM(
    cfg: Awaited<ReturnType<typeof this.getConfig>>,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  ) {
    const controller = new AbortController()
    let timer: NodeJS.Timeout | undefined
    if (cfg.timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
    }
    try {
      let url = ''
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      }
      let body: any = null
      const isAzure = cfg.provider === 'azure'
      const isGrok = cfg.provider === 'grok'
      const defaultBase = isGrok ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1'
      const base = (cfg.baseUrl || defaultBase).replace(/\/$/, '')
      const key =
        cfg.openaiApiKey ||
        (isGrok
          ? process.env.GROK_API_KEY || process.env.XAI_API_KEY || process.env.AI_API_KEY || ''
          : process.env.AI_API_KEY || '')
      const shouldUseResponsesEndpoint =
        !isAzure &&
        !isGrok &&
        /gpt-4\.1|gpt-5|gpt-4o-mini-2024|o3|o4|realtime|codex/i.test(cfg.model)

      if (isAzure) {
        const ep = cfg.azure.endpoint.replace(/\/$/, '')
        const deployment = cfg.azure.deployment || cfg.model
        url = `${ep}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(cfg.azure.apiVersion)}`
        headers['api-key'] = cfg.azure.apiKey
        body = { messages, temperature: 0.2, max_tokens: cfg.maxTokens }
      } else if (shouldUseResponsesEndpoint) {
        url = `${base}/responses`
        if (key) headers['authorization'] = `Bearer ${key}`
        body = {
          model: cfg.model,
          input: messages.map((m) => ({
            role: m.role,
            content: [{ type: 'input_text', text: m.content }],
          })),
          max_output_tokens: cfg.maxTokens,
        }
      } else {
        url = `${base}/chat/completions`
        if (key) headers['authorization'] = `Bearer ${key}`
        body = {
          model: cfg.model,
          messages,
          temperature: 0.2,
          max_tokens: cfg.maxTokens,
        }
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      } as any)
      const ct = res.headers.get('content-type') || ''
      const data: any = ct.includes('application/json') ? await res.json() : await res.text()
      if (!res.ok) {
        const errMsg =
          typeof data === 'string' ? data : data?.error?.message || 'LLM request failed'
        throw new Error(errMsg)
      }
      let text = ''
      if (shouldUseResponsesEndpoint) {
        const segments: string[] = []
        const append = (value: any) => {
          if (!value) return
          if (Array.isArray(value)) {
            value.forEach((v) => append(v))
          } else if (typeof value === 'string') {
            if (value.trim()) segments.push(value)
          }
        }

        if (typeof data?.output_text === 'string') {
          append(data.output_text)
        } else if (Array.isArray(data?.output_text)) {
          append(data.output_text)
        }

        if (Array.isArray(data?.output)) {
          for (const item of data.output) {
            const contents = item?.content
            if (Array.isArray(contents)) {
              for (const chunk of contents) {
                if (chunk?.type === 'output_text' && typeof chunk?.text === 'string') {
                  append(chunk.text)
                } else if (typeof chunk?.text === 'string') {
                  append(chunk.text)
                } else if (Array.isArray(chunk?.text)) {
                  append(chunk.text)
                }
              }
            }
          }
        }

        if (Array.isArray(data?.choices)) {
          for (const choice of data.choices) {
            const message = choice?.message
            if (!message) continue
            if (typeof message?.content === 'string') {
              append(message.content)
            } else if (Array.isArray(message?.content)) {
              for (const chunk of message.content) {
                if (typeof chunk === 'string') append(chunk)
                else if (typeof chunk?.text === 'string') append(chunk.text)
                else if (Array.isArray(chunk?.text)) append(chunk.text)
              }
            }
          }
        }

        text = segments.join('\n').trim()
      } else {
        text = data?.choices?.[0]?.message?.content ?? ''
        if (Array.isArray(text)) {
          text = text
            .map((part: any) => {
              if (typeof part === 'string') return part
              if (typeof part?.text === 'string') return part.text
              if (Array.isArray(part?.text)) {
                return part.text.filter((x: any) => typeof x === 'string').join('\n')
              }
              return ''
            })
            .filter(Boolean)
            .join('\n')
        }
        if (typeof text !== 'string') {
          text = ''
        }
      }
      if (!text) {
        const info = typeof data === 'string' ? data : JSON.stringify(data)?.slice(0, 500)
        throw new Error(`Empty LLM response${info ? `: ${info}` : ''}`)
      }
      return text
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private extractCode(raw: string): string {
    if (!raw) return ''
    // Prefer fenced code blocks
    const fenceRe = /```[a-zA-Z]*\n([\s\S]*?)```/g
    const matches = Array.from(raw.matchAll(fenceRe))
    if (matches.length > 0) {
      // choose the first block
      return (matches[0][1] || '').trim()
    }
    // Fallback: remove leading/trailing commentary lines
    const lines = raw.split(/\r?\n/).map((s) => s.trimEnd())
    const keep = lines.filter(
      (l) => !/^```/.test(l) && !/^\s*(?:Here is|代码|Explanation|说明)/i.test(l)
    )
    return keep.join('\n').trim()
  }

  private postProcessSnippet(code: string, opts?: { maxLines?: number; maxCol?: number }): string {
    const rawMaxLines = Number(opts?.maxLines ?? process.env.AI_CODE_MAX_LINES ?? 0)
    const rawMaxCol = Number(opts?.maxCol ?? process.env.AI_CODE_MAX_COL ?? 0)
    const MAX_LINES =
      !Number.isFinite(rawMaxLines) || rawMaxLines <= 0
        ? Infinity
        : Math.max(1, Math.min(200, Math.floor(rawMaxLines)))
    const MAX_COL =
      !Number.isFinite(rawMaxCol) || rawMaxCol <= 0
        ? Infinity
        : Math.max(10, Math.min(400, Math.floor(rawMaxCol)))
    const lines = (code || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*import\s+.*$/, '').replace(/\s+$/, ''))
      .filter((l) => l.trim() !== '')
    const limitedLines = MAX_LINES === Infinity ? lines : lines.slice(0, MAX_LINES)
    const clipped = limitedLines.map((l) =>
      MAX_COL === Infinity || l.length <= MAX_COL ? l : l.slice(0, MAX_COL)
    )
    return clipped.join('\n')
  }

  finalizeSnippet(code: string, opts?: { maxLines?: number; maxCol?: number }): string {
    return this.postProcessSnippet(code, opts)
  }

  async generateWithLLM(
    input: { snapshot: Snapshot; prompt: string; focusNodeId?: string | null },
    opts?: { maxLines?: number; maxCol?: number },
    userId?: number
  ) {
    console.log('generateWithLLM')
    const { snapshot, prompt, focusNodeId } = input
    const { system, user } = this.buildPrompt({
      snapshot,
      userPrompt: prompt,
      focusNodeId,
    })
    const cfg = await this.getConfig(userId)
    const text = await this.callLLM(cfg, [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
    console.log(text)
    const code = this.postProcessSnippet(this.extractCode(text), opts)
    return { snippet: code }
  }

  /**
   * Normalize a free-form use case description document into structured user scenarios.
   * Returns JSON with shape:
   * { cases: [{ caseCode, moduleId, moduleName, submenu, title, description, sourceDoc, userStory, acceptanceCriteria, precondition, testSteps, expectedResult }] }
   *
   * 说明：
   * - precondition / testSteps / expectedResult 设计上与当前项目的 Livestream CSV 模板兼容，便于后端直接生成 UserScenarioStep。
   */
  async normalizeUserScenarios(input: {
    rawText: string
    project: string
    docType?: string
    moduleIdHint?: string
    moduleNameHint?: string
    sourceDoc?: string
    userId?: number
    aiHint?: string
  }): Promise<
    | {
        cases: {
          caseCode: string
          moduleId?: string | null
          moduleName?: string | null
          submenu?: string | null
          title: string
          description?: string | null
          sourceDoc?: string | null
          userStory?: string | null
          acceptanceCriteria?: string | null
          precondition?: string | null
          testSteps?: string | null
          expectedResult?: string | null
        }[]
      }
    | null
  > {
    const {
      rawText,
      project,
      docType,
      moduleIdHint,
      moduleNameHint,
      sourceDoc,
      userId,
      aiHint,
    } = input
    if (!rawText || !rawText.trim()) {
      return { cases: [] }
    }
    const cfg = await this.getConfig(userId)
    const sysLines: string[] = [
      '你是测试用例抽取器，负责把用例说明文档解析为结构化的“用户场景(user scenarios)”列表。',
      '只输出 JSON 字符串，不要解释，不要自然语言。',
      'JSON 结构严格为：',
      '{ "cases": [ { "caseCode": string, "moduleId": string|null, "moduleName": string|null, "submenu": string|null, "title": string, "description": string|null, "sourceDoc": string|null, "userStory": string|null, "acceptanceCriteria": string|null, "precondition": string|null, "testSteps": string|null, "expectedResult": string|null } ] }',
      '字段含义：',
      '- caseCode: 用例或检查点的唯一编码，例如 UI-HOST-001、UI-GUEST-003、GLW-1-003-01 等；没有编码时可以根据文档结构生成一个稳定的 ID，例如 LIVEKIT-HOST-001。',
      '- moduleId: 模块/功能组 ID，例如 GLW-1-003、LIVEKIT-HOST，没有时可使用调用方提供的 moduleIdHint。',
      '- moduleName: 模块名称，例如 “LiveKit Host Flow”、“Pre-Live Setup”，没有时可使用 moduleNameHint 或文档中的模块标题。',
      '- submenu: 子菜单/角色/平台标识，例如 host / viewer / interaction / general。',
      '- title: 用例标题，简短一句话，中文优先，例如 “开始直播（无 OBS / 无 RTMP）”。',
      '- description: 更详细的检查点描述或前置条件，允许多行文本。',
      '- sourceDoc: 源文档标识，例如 livekit。',
      '- userStory: 关联的 User Story 描述或编号。如果文档中存在类似 "As a host, I can ..." / "As a viewer, I can ..." 这样的 User Story 句子，请尽量为每个用例找到并完整拷贝对应的英文句子到 userStory 字段；若无明确对应，则可以使用 User Story 标题或编号，例如 “Host #1”、“Guest #3”。',
      '- acceptanceCriteria: 该用例的验收标准/关键条件列表，允许多行文本。如果文档中有短语如 "From Studio open"、"Given ... When ... Then ..." 等 Acceptance Criteria，请收集到这里，一条或多条都可以，使用换行分隔。',
      '- precondition: 本用例的前置条件，可以包含环境依赖、账号状态、数据准备等，允许多行文本。',
      '- testSteps: 测试步骤列表，建议按 “1. ...；2. ...；3. ...” 的形式书写，每一步包含“操作 + 关键检查点”，便于后端直接拆分为步骤。',
      '- expectedResult: 预期结果列表，建议与 testSteps 一一对应，同样使用 “1. ...；2. ...” 的格式；如果文档中没有明显拆分，可使用多行文本汇总关键期望。',
      'project 字段：本次调用的 project 是 ' + project + '，请根据 project 选择合适的拆分粒度；对 live-stream 项目，按照 Host Flow / Guest Flow / Interaction 等区块拆分为多个场景。',
      'docType 字段：如果 docType 为 livekit，文档里会有 Host Flow / Guest Flow 区块，以及 UI-HOST-xxx / UI-GUEST-xxx 编号，请尽量使用这些编号作为 caseCode。',
      '约束：',
      '- 不要输出注释或其它字段名；',
      '- 不要输出 Markdown 代码块标记 ```；',
      '- 所有字符串字段都要是有效的 JSON 字符串；',
      '- 如果无法解析出某个字段，可以用 null 或空字符串，但必须保留字段名称。',
      '- 特别注意：不要丢弃 User Story 英文句子，例如 "As a host, I can start a livestream"；即使已经在别的字段中用了简化标题，也要在 userStory 或 description 中保留原文。',
      '- 特别注意：不要丢弃 Acceptance Criteria 里的短语，例如 "From Studio open"；请放在 acceptanceCriteria 中，并保持原文。',
      '- 特别注意：如果文档已经按步骤列出了测试过程（例如 “1. 调用接口 /admin/live/start；2. 查询 Mongo/Redis；3. 校验 errcode ...”），请尽量按照当前项目 Livestream CSV 模板的风格，将其整理到 testSteps 和 expectedResult 字段中，使用 “1. ...；2. ...” 的形式，便于后端直接导入为步骤。',
    ]
    const system = sysLines.join('\n')
    const userLines: string[] = [
      `project: ${project}`,
      `docType: ${docType || 'unknown'}`,
      moduleIdHint ? `moduleIdHint: ${moduleIdHint}` : '',
      moduleNameHint ? `moduleNameHint: ${moduleNameHint}` : '',
      sourceDoc ? `sourceDoc: ${sourceDoc}` : '',
      aiHint && aiHint.trim()
        ? [
            '',
            '【调用方补充说明（优先级高于默认规则，可适度覆盖上面的通用约束）】',
            aiHint.trim(),
          ].join('\n')
        : '',
      '',
      '下面是完整的用例说明文档内容：',
      rawText,
    ].filter(Boolean)
    const user = userLines.join('\n')
    const text = await this.callLLM(cfg, [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
    if (!text) return null
    let jsonText = text.trim()
    // strip possible code fences
    if (jsonText.startsWith('```')) {
      const m = jsonText.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
      if (m && m[1]) jsonText = m[1].trim()
    }
    try {
      const parsed = JSON.parse(jsonText)
      if (!parsed || typeof parsed !== 'object') return null
      if (!Array.isArray(parsed.cases)) {
        return { cases: [] }
      }
      const normCases = parsed.cases
        .filter((c: any) => c && typeof c === 'object')
        .map((c: any) => {
          const caseCode = (c.caseCode || '').toString().trim()
          const title = (c.title || caseCode || '').toString().trim()
          const acceptance =
            c.acceptanceCriteria != null ? String(c.acceptanceCriteria) : null
          const precondition =
            c.precondition != null ? String(c.precondition) : null
          const testSteps =
            c.testSteps != null ? String(c.testSteps) : null
          const expectedResult =
            c.expectedResult != null ? String(c.expectedResult) : null
          return {
            caseCode: caseCode || title,
            moduleId:
              (c.moduleId != null ? String(c.moduleId) : moduleIdHint || null) || null,
            moduleName:
              (c.moduleName != null
                ? String(c.moduleName)
                : moduleNameHint || null) || null,
            submenu: c.submenu != null ? String(c.submenu) : null,
            title: title || caseCode || '未命名用例',
            description:
              c.description != null ? String(c.description) : (c.title as string) || null,
            sourceDoc:
              c.sourceDoc != null
                ? String(c.sourceDoc)
                : sourceDoc || (docType as string) || 'unknown',
            userStory: c.userStory != null ? String(c.userStory) : null,
            acceptanceCriteria: acceptance,
            precondition,
            testSteps,
            expectedResult,
          }
        })
      return { cases: normCases }
    } catch {
      return null
    }
  }

  // ---- MCP integration ----
  /**
   * Call local MCP service to generate test code from a high-level spec.
   * Defaults to http://localhost:3003 unless MCP_SERVICE_URL is set.
   */
  async generateFromSpec(spec: any): Promise<{ code: string }> {
    const base = (process.env.MCP_SERVICE_URL || 'http://localhost:3003').replace(/\/$/, '')
    const url = `${base}/generate`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(spec ?? {}),
    } as any)
    const ct = res.headers.get('content-type') || ''
    const data: any = ct.includes('application/json') ? await res.json() : await res.text()
    if (!res.ok) {
      const msg = typeof data === 'string' ? data : data?.error || 'MCP error'
      throw new Error(`MCP request failed: ${msg}`)
    }
    const code = (typeof data?.code === 'string' ? data.code : data?.data?.code || '').toString()
    if (!code) throw new Error('MCP returned empty code')
    return { code }
  }

  /**
   * Generate a functions/class snippet from an inspector snapshot.
   * One locator per function. Function name is derived from content-desc/text
   * (special chars and spaces removed; length <= 20). Selector priority:
   * content-desc > resource-id (resourceId/resourceIdMatches) > text > XPath fallback.
   */
  generateInspectorLibs(input: {
    snapshot: Snapshot
    focusNodeId?: string | null
    template?: string
    className?: string
  }): { code: string } {
    const { snapshot, focusNodeId, template, className } = input || ({} as any)
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : []
    if (!nodes.length) return { code: '' }
    const esc = (s: string) => (s ?? '').replace(/[\\']/g, (m) => `\\${m}`)
    const bestSelectorByReq = (n: NodeInfo): string => {
      if (n.contentDesc) return `~${esc(n.contentDesc)}`
      if (n.resourceId) {
        const rid = n.resourceId || ''
        const hasFull = /[:/]/.test(rid)
        if (hasFull) {
          return `android=new UiSelector().resourceId(\"${rid.replace(/\\"/g, '\\\\"')}\")`
        }
        return `android=new UiSelector().resourceIdMatches(\".*${rid.replace(/\\"/g, '\\\\"')}\")`
      }
      if (n.text)
        return `android=new UiSelector().text(\"${(n.text || '').replace(/\\"/g, '\\\\"')}\")`
      // Fallback xpath using class + attributes
      const parts: string[] = []
      if (n.class) parts.push(n.class)
      if (n.text) parts.push(`@text=\"${(n.text || '').replace(/\\"/g, '\\\\"')}\"`)
      if (n.resourceId) parts.push(`@resource-id=\"${n.resourceId}\"`)
      const xpath =
        parts.length > 1 ? `//${parts[0]}[${parts.slice(1).join(' and ')}]` : `//${parts[0] || '*'}`
      return xpath
    }
    const sanitizeName = (raw: string): string => {
      let s = (raw || '').normalize('NFKC')
      // Keep unicode letters/numbers; collapse others to underscore
      s = s.replace(/[^\p{L}\p{N}]+/gu, '_')
      s = s.replace(/^_+|_+$/g, '')
      if (!s) s = 'el'
      // Ensure not starting with digit
      if (/^\d/.test(s)) s = '_' + s
      if (s.length > 20) s = s.slice(0, 20)
      // lowerCamelCase: make first char lowercase when possible
      s = s.charAt(0).toLowerCase() + s.slice(1)
      return s
    }
    const used = new Map<string, number>()
    const uniq = (base: string): string => {
      const cnt = used.get(base) || 0
      if (cnt === 0) {
        used.set(base, 1)
        return base
      }
      const name = `${base}_${cnt + 1}`
      used.set(base, cnt + 1)
      return name.length > 24 ? name.slice(0, 24) : name
    }
    // Order: focused first (if present), then others
    const list: NodeInfo[] = (() => {
      if (!focusNodeId) return nodes.slice()
      const idx = nodes.findIndex((n) => n.nodeId === focusNodeId)
      if (idx < 0) return nodes.slice()
      return [nodes[idx], ...nodes.slice(0, idx), ...nodes.slice(idx + 1)]
    })()
    const sanitizeClass = (raw: string): string => {
      let s = (raw || '').normalize('NFKC')
      // remove non-letters/numbers, then PascalCase by splitting on separators
      s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      if (!s) return 'GeneratedLib'
      const parts = s.split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      s = parts.join('')
      // ensure starts with a letter or underscore
      if (!/^[_\p{L}]/u.test(s)) s = '_' + s
      if (s.length > 40) s = s.slice(0, 40)
      return s
    }
    const clsName = sanitizeClass(className || 'GeneratedLib')

    const lines: string[] = []
    const now = new Date()
    const hdr = [
      `// Generated from Inspector at ${now.toISOString()}`,
      template ? `// Template: ${template}` : undefined,
      `// Class: ${clsName}`,
      'import {IPage} from "./interface/ipage"',
    ]
      .filter(Boolean)
      .join('\n')
    lines.push(hdr)
    lines.push(`export class ${clsName} extends IPage {`)
    lines.push(`  constructor(testcase: any) {\n    super(testcase)\n}`)
    const clickableList = list.filter((n) => !!n.clickable)
    for (let i = 0; i < clickableList.length; i++) {
      const n = clickableList[i]
      const displayName =
        n.contentDesc?.trim() || n.text?.trim() || n.resourceId?.split('/')?.pop() || ''
      let base = sanitizeName(displayName)
      if (!base) base = `el_${i + 1}`
      const fn = uniq(base)
      const selector = bestSelectorByReq(n)
      const body = `  async ${fn}() {\n    await this.page.$('${selector}')\n    await this.page.pause(1000)\n  }`
      lines.push(body)
    }
    lines.push('}')
    const code = lines.join('\n\n') + '\n'
    return { code }
  }
}
