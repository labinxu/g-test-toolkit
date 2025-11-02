import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

type Bounds = { x1: number; y1: number; x2: number; y2: number };
type NodeInfo = {
  nodeId: string;
  class: string;
  text: string;
  resourceId: string;
  contentDesc: string;
  clickable: boolean;
  bounds: Bounds;
};

type Snapshot = {
  screenshotBase64?: string;
  screenshotUrl?: string;
  screen: { width: number; height: number };
  nodes: NodeInfo[];
  takenAt: number;
};

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
    }));
    const provider = (
      aiCfg.provider ||
      process.env.AI_PROVIDER ||
      'openai'
    ).toLowerCase();
    const isGrok = provider === 'grok';
    // For openai/custom: model is OpenAI model; For azure: model maps to deployment name
    const model = aiCfg.model || process.env.AI_MODEL || 'gpt-4o-mini';
    const baseUrl = aiCfg.baseUrl || process.env.AI_BASE_URL || '';
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
    ).toString();
    const azure = {
      endpoint: (
        aiCfg.baseUrl ||
        process.env.AZURE_OPENAI_ENDPOINT ||
        ''
      ).toString(),
      apiKey: (
        aiCfg.apiKey ||
        process.env.AZURE_OPENAI_API_KEY ||
        ''
      ).toString(),
      deployment: (
        aiCfg.model ||
        process.env.AZURE_OPENAI_DEPLOYMENT ||
        ''
      ).toString(),
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview',
    };
    const envTimeout = Number(process.env.AI_TIMEOUT_MS ?? 0);
    let timeoutMs = 10000;
    if (aiCfg.timeoutMs != null) {
      if (aiCfg.timeoutMs <= 0) timeoutMs = 0;
      else timeoutMs = Math.max(1000, Math.min(600000, aiCfg.timeoutMs));
    } else if (Number.isFinite(envTimeout)) {
      timeoutMs =
        envTimeout <= 0 ? 0 : Math.max(1000, Math.min(600000, envTimeout));
    }
    const maxTokensCandidate =
      (aiCfg as any).maxTokens ??
      Number(process.env.AI_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS || 0);
    const maxTokens = Math.max(
      64,
      Math.min(512000, Number(maxTokensCandidate) || 512),
    );
    return {
      provider,
      model,
      baseUrl,
      openaiApiKey,
      azure,
      timeoutMs,
      maxTokens,
    };
  }

  async isLLMConfigured(userId?: number): Promise<boolean> {
    const { provider, openaiApiKey, baseUrl, azure } =
      await this.getConfig(userId);
    console.log('isLLMConfigured', provider, baseUrl, azure);
    if (provider === 'openai') return !!openaiApiKey;
    if (provider === 'grok') return !!openaiApiKey;
    if (provider === 'azure')
      return !!(azure.endpoint && azure.apiKey && azure.deployment);
    // custom/OpenAI-compatible: require either baseUrl+key or openaiApiKey
    return !!(baseUrl && (openaiApiKey || process.env.AI_API_KEY));
  }

  private escapeQuote(s: string) {
    return (s ?? '').replace(/[\\']/g, (m) => `\\${m}`);
  }

  private isInputClass(n: NodeInfo): boolean {
    const cls = (n.class || '').toLowerCase();
    return (
      cls.includes('edittext') ||
      cls.includes('textinput') ||
      cls.includes('textfield') ||
      cls.includes('autocomplete') ||
      cls.includes('search')
    );
  }

  private bestSelector(n: NodeInfo): string {
    if (n.contentDesc) return `~${this.escapeQuote(n.contentDesc)}`;
    if (n.resourceId) return `#${this.escapeQuote(n.resourceId)}`;
    if (n.text)
      return `android=new UiSelector().text(\"${(n.text || '').replace(/\\"/g, '\\\\"')}\")`;
    // Fallback xpath using class + attributes
    const parts: string[] = [];
    if (n.class) parts.push(n.class);
    if (n.text)
      parts.push(`@text=\"${(n.text || '').replace(/\\"/g, '\\\\"')}\"`);
    if (n.resourceId) parts.push(`@resource-id=\"${n.resourceId}\"`);
    const xpath =
      parts.length > 1
        ? `//${parts[0]}[${parts.slice(1).join(' and ')}]`
        : `//${parts[0] || '*'}`;
    return xpath;
  }

  private parseIntent(prompt: string) {
    const p = (prompt || '').toLowerCase();
    const isLongPress = /长按|long\s*press/.test(p);
    const isInput = /输入|set\s*value|type/.test(p) && !isLongPress;
    const isClick = !isInput && !isLongPress; // default

    // try extract text inside quotes
    let inputText = '';
    const m1 = prompt.match(/['\"]([^'\"]{1,200})['\"]/);
    if (m1) inputText = m1[1];
    if (!inputText) {
      // simple zh heuristic: after "输入"
      const m2 = prompt.match(/输入([\u4e00-\u9fa5\w\s\-_.]{1,40})/);
      if (m2) inputText = m2[1].trim();
    }
    const longPressMs = (() => {
      const m = prompt.match(/(\d{2,4})\s*ms|长按\s*(\d{2,4})/i);
      const n = m ? parseInt(m[1] || m[2] || '800', 10) : 800;
      return Math.max(200, Math.min(3000, n || 800));
    })();
    return { isClick, isInput, isLongPress, inputText, longPressMs };
  }

  private findTargetNode(
    snapshot: Snapshot,
    prompt: string,
    focusNodeId?: string | null,
  ): NodeInfo | null {
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    if (focusNodeId) {
      const found = nodes.find((n) => n.nodeId === focusNodeId);
      if (found) return found;
    }
    const hints: string[] = [];
    // collect quoted hints or words around known verbs
    const qm = prompt.match(/['\"]([^'\"]{1,200})['\"]/);
    if (qm) hints.push(qm[1].toLowerCase());
    const zh = prompt.match(/[\u4e00-\u9fa5]{2,8}/g) || [];
    hints.push(...zh.map((s) => s.toLowerCase()));

    const score = (n: NodeInfo): number => {
      let s = 0;
      const area = Math.max(
        1,
        (n.bounds.x2 - n.bounds.x1) * (n.bounds.y2 - n.bounds.y1),
      );
      s += Math.min(50, Math.round(Math.log10(area + 10) * 10));
      if (n.clickable) s += 10;
      const txt = (n.text || '').toLowerCase();
      const desc = (n.contentDesc || '').toLowerCase();
      const rid = (n.resourceId || '').toLowerCase();
      for (const h of hints) {
        if (!h) continue;
        if (txt.includes(h)) s += 40;
        if (desc.includes(h)) s += 35;
        if (rid.includes(h)) s += 30;
      }
      return s;
    };

    let candidates = nodes;
    // prefer clickable when intent is click/long-press
    const p = prompt.toLowerCase();
    if (/点击|click|tap|长按|press/.test(p)) {
      candidates = nodes.filter((n) => n.clickable) as any;
      if (candidates.length === 0) candidates = nodes;
    }
    if (candidates.length === 0) return null;
    return candidates.slice().sort((a, b) => score(b) - score(a))[0] || null;
  }

  generateFromRules(input: {
    snapshot: Snapshot;
    prompt: string;
    focusNodeId?: string | null;
  }): {
    snippet: string;
    usedSelector?: string;
  } {
    const { snapshot, prompt, focusNodeId } = input;
    const intent = this.parseIntent(prompt || '');
    const node = this.findTargetNode(
      snapshot,
      prompt || '',
      focusNodeId || undefined,
    );
    if (!node) {
      return { snippet: `// Unable to infer element from snapshot` };
    }
    const sel = this.bestSelector(node);
    if (intent.isLongPress) {
      const ms = intent.longPressMs;
      const snippet = `await (await this.page.$('${sel}')).touchAction({ action: 'longPress', duration: ${ms} })`;
      return { snippet, usedSelector: sel };
    }
    if (intent.isInput || this.isInputClass(node)) {
      const text = intent.inputText || 'your text';
      const esc = this.escapeQuote(text);
      const snippet = [
        `const el = await this.page.$('${sel}')`,
        `await el.click()`,
        `await el.setValue('${esc}')`,
      ].join('\n');
      return { snippet, usedSelector: sel };
    }
    // default click
    const snippet = `await this.page.$('${sel}').click()`;
    return { snippet, usedSelector: sel };
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
    };
  }

  private rankNodes(nodes: NodeInfo[], focusId?: string | null) {
    const S = (n: NodeInfo) => {
      let s = 0;
      const area = Math.max(
        1,
        (n.bounds.x2 - n.bounds.x1) * (n.bounds.y2 - n.bounds.y1),
      );
      const areaScore = Math.min(30, Math.round(Math.log10(area + 10) * 8));
      s += areaScore;
      if (n.clickable) s += 20;
      if (n.contentDesc) s += 20;
      if (n.resourceId) s += 12;
      if (n.text) s += 10;
      if (focusId && n.nodeId === focusId) s += 1000;
      return s;
    };
    return nodes.slice().sort((a, b) => S(b) - S(a));
  }

  private buildPrompt(input: {
    snapshot: Snapshot;
    userPrompt: string;
    focusNodeId?: string | null;
  }) {
    const { snapshot, userPrompt, focusNodeId } = input;
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    // Only keep actionable nodes to reduce noise for the LLM
    let nodePool = nodes.filter((n) => n.clickable || this.isInputClass(n));
    if (nodePool.length === 0) nodePool = nodes;
    if (focusNodeId && nodePool.every((n) => n.nodeId !== focusNodeId)) {
      const focus = nodes.find((n) => n.nodeId === focusNodeId);
      if (focus) nodePool = [focus, ...nodePool];
    }
    const ranked = this.rankNodes(nodePool, focusNodeId);
    const trimmed = ranked.slice(0, 120).map((n) => this.summarizeNode(n));
    const selected = focusNodeId
      ? nodes.find((n) => n.nodeId === focusNodeId)
      : null;
    const selectedBrief = selected
      ? {
          class: selected.class,
          text: (selected.text || '').slice(0, 80),
          resourceId: (selected.resourceId || '').slice(0, 120),
          contentDesc: (selected.contentDesc || '').slice(0, 120),
          clickable: !!selected.clickable,
          bounds: selected.bounds,
        }
      : null;

    const system = [
      '你是自动化脚本生成器。只输出可直接粘贴的 TypeScript 代码，不要解释、注释或多余文本。',
      '使用 WebdriverIO 风格 API：await this.page.$(selector).click()；对输入框使用 setValue。',
      '选择器优先级：~content-desc（accessibility id） > #resource-id > UiSelector(text) > XPath（最后手段）。',
      '不要引入新的 import，不要创建类/函数。',
    ].join('\n');

    const fewShots = [
      {
        ask: '点击“登录”按钮',
        code: "await this.page.$('~登录').click()",
      },
      {
        ask: '在用户名输入框输入 test_user',
        code: [
          "const el = await this.page.$('#com.example:id/username')",
          'await el.click()',
          "await el.setValue('test_user')",
        ].join('\n'),
      },
      {
        ask: '长按“更多”800ms',
        code: "await (await this.page.$('android=new UiSelector().text(\"更多\")')).touchAction({ action: 'longPress', duration: 800 })",
      },
    ];
    const fewShotBlock = fewShots
      .map((x) => `任务: ${x.ask}\n代码:\n${x.code}`)
      .join('\n\n');

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
      .join('\n');

    return { system, user };
  }

  private async callLLM(
    cfg: Awaited<ReturnType<typeof this.getConfig>>,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ) {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    if (cfg.timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    }
    try {
      let url = '';
      let headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      let body: any = null;
      const isAzure = cfg.provider === 'azure';
      const isGrok = cfg.provider === 'grok';
      const defaultBase = isGrok
        ? 'https://api.x.ai/v1'
        : 'https://api.openai.com/v1';
      const base = (cfg.baseUrl || defaultBase).replace(
        /\/$/,
        '',
      );
      const key =
        cfg.openaiApiKey ||
        (isGrok
          ? process.env.GROK_API_KEY ||
            process.env.XAI_API_KEY ||
            process.env.AI_API_KEY ||
            ''
          : process.env.AI_API_KEY || '');
      const shouldUseResponsesEndpoint =
        !isAzure &&
        !isGrok &&
        /gpt-4\.1|gpt-5|gpt-4o-mini-2024|o3|o4|realtime|codex/i.test(cfg.model);

      if (isAzure) {
        const ep = cfg.azure.endpoint.replace(/\/$/, '');
        const deployment = cfg.azure.deployment || cfg.model;
        url = `${ep}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(cfg.azure.apiVersion)}`;
        headers['api-key'] = cfg.azure.apiKey;
        body = { messages, temperature: 0.2, max_tokens: cfg.maxTokens };
      } else if (shouldUseResponsesEndpoint) {
        url = `${base}/responses`;
        if (key) headers['authorization'] = `Bearer ${key}`;
        body = {
          model: cfg.model,
          input: messages.map((m) => ({
            role: m.role,
            content: [{ type: 'input_text', text: m.content }],
          })),
          max_output_tokens: cfg.maxTokens,
        };
      } else {
        url = `${base}/chat/completions`;
        if (key) headers['authorization'] = `Bearer ${key}`;
        body = {
          model: cfg.model,
          messages,
          temperature: 0.2,
          max_tokens: cfg.maxTokens,
        };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      } as any);
      const ct = res.headers.get('content-type') || '';
      const data: any = ct.includes('application/json')
        ? await res.json()
        : await res.text();
      if (!res.ok) {
        const errMsg =
          typeof data === 'string'
            ? data
            : data?.error?.message || 'LLM request failed';
        throw new Error(errMsg);
      }
      let text = '';
      if (shouldUseResponsesEndpoint) {
        const segments: string[] = [];
        const append = (value: any) => {
          if (!value) return;
          if (Array.isArray(value)) {
            value.forEach((v) => append(v));
          } else if (typeof value === 'string') {
            if (value.trim()) segments.push(value);
          }
        };

        if (typeof data?.output_text === 'string') {
          append(data.output_text);
        } else if (Array.isArray(data?.output_text)) {
          append(data.output_text);
        }

        if (Array.isArray(data?.output)) {
          for (const item of data.output) {
            const contents = item?.content;
            if (Array.isArray(contents)) {
              for (const chunk of contents) {
                if (
                  chunk?.type === 'output_text' &&
                  typeof chunk?.text === 'string'
                ) {
                  append(chunk.text);
                } else if (typeof chunk?.text === 'string') {
                  append(chunk.text);
                } else if (Array.isArray(chunk?.text)) {
                  append(chunk.text);
                }
              }
            }
          }
        }

        if (Array.isArray(data?.choices)) {
          for (const choice of data.choices) {
            const message = choice?.message;
            if (!message) continue;
            if (typeof message?.content === 'string') {
              append(message.content);
            } else if (Array.isArray(message?.content)) {
              for (const chunk of message.content) {
                if (typeof chunk === 'string') append(chunk);
                else if (typeof chunk?.text === 'string') append(chunk.text);
                else if (Array.isArray(chunk?.text)) append(chunk.text);
              }
            }
          }
        }

        text = segments.join('\n').trim();
      } else {
        text = data?.choices?.[0]?.message?.content ?? '';
        if (Array.isArray(text)) {
          text = text
            .map((part: any) => {
              if (typeof part === 'string') return part;
              if (typeof part?.text === 'string') return part.text;
              if (Array.isArray(part?.text)) {
                return part.text
                  .filter((x: any) => typeof x === 'string')
                  .join('\n');
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }
        if (typeof text !== 'string') {
          text = '';
        }
      }
      if (!text) {
        const info =
          typeof data === 'string' ? data : JSON.stringify(data)?.slice(0, 500);
        throw new Error(`Empty LLM response${info ? `: ${info}` : ''}`);
      }
      return text;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private extractCode(raw: string): string {
    if (!raw) return '';
    // Prefer fenced code blocks
    const fenceRe = /```[a-zA-Z]*\n([\s\S]*?)```/g;
    const matches = Array.from(raw.matchAll(fenceRe));
    if (matches.length > 0) {
      // choose the first block
      return (matches[0][1] || '').trim();
    }
    // Fallback: remove leading/trailing commentary lines
    const lines = raw.split(/\r?\n/).map((s) => s.trimEnd());
    const keep = lines.filter(
      (l) =>
        !/^```/.test(l) && !/^\s*(?:Here is|代码|Explanation|说明)/i.test(l),
    );
    return keep.join('\n').trim();
  }

  private postProcessSnippet(
    code: string,
    opts?: { maxLines?: number; maxCol?: number },
  ): string {
    const rawMaxLines = Number(
      opts?.maxLines ?? process.env.AI_CODE_MAX_LINES ?? 0,
    );
    const rawMaxCol = Number(opts?.maxCol ?? process.env.AI_CODE_MAX_COL ?? 0);
    const MAX_LINES =
      !Number.isFinite(rawMaxLines) || rawMaxLines <= 0
        ? Infinity
        : Math.max(1, Math.min(200, Math.floor(rawMaxLines)));
    const MAX_COL =
      !Number.isFinite(rawMaxCol) || rawMaxCol <= 0
        ? Infinity
        : Math.max(10, Math.min(400, Math.floor(rawMaxCol)));
    const lines = (code || '')
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*import\s+.*$/, '').replace(/\s+$/, ''))
      .filter((l) => l.trim() !== '');
    const limitedLines =
      MAX_LINES === Infinity ? lines : lines.slice(0, MAX_LINES);
    const clipped = limitedLines.map((l) =>
      MAX_COL === Infinity || l.length <= MAX_COL ? l : l.slice(0, MAX_COL),
    );
    return clipped.join('\n');
  }

  finalizeSnippet(
    code: string,
    opts?: { maxLines?: number; maxCol?: number },
  ): string {
    return this.postProcessSnippet(code, opts);
  }

  async generateWithLLM(
    input: { snapshot: Snapshot; prompt: string; focusNodeId?: string | null },
    opts?: { maxLines?: number; maxCol?: number },
    userId?: number,
  ) {
    console.log('generateWithLLM');
    const { snapshot, prompt, focusNodeId } = input;
    const { system, user } = this.buildPrompt({
      snapshot,
      userPrompt: prompt,
      focusNodeId,
    });
    const cfg = await this.getConfig(userId);
    const text = await this.callLLM(cfg, [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    console.log(text);
    const code = this.postProcessSnippet(this.extractCode(text), opts);
    return { snippet: code };
  }
}
