'use client';

import { create } from 'zustand';

type HttpMethod = 'GET' | 'POST' | 'DELETE';

export type CurlRunnerConfig = {
  method: HttpMethod;
  category: string;
  url: string;
  headers: string;
  payload: string;
  repeatCount: number;
  repeatIntervalMs: number;
};

export type CurlExecuteResult = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
};

type CurlRunnerState = {
  isRunning: boolean;
  config: CurlRunnerConfig | null;
  result: CurlExecuteResult | null;
  error: string | null;
  runStats: { total: number; statuses: number[] };
  start: (cfg: CurlRunnerConfig) => void;
  stop: () => void;
};

let timer: NodeJS.Timeout | null = null;

async function executeOnce(cfg: CurlRunnerConfig, set: (fn: (prev: CurlRunnerState) => Partial<CurlRunnerState>) => void) {
  try {
    const res = await fetch('/api/curl/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        method: cfg.method,
        url: cfg.url.trim(),
        category: cfg.category,
        headers: cfg.headers,
        payload: cfg.payload,
      }),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object') {
        const status =
          typeof (data as any).status === 'number' ? (data as any).status : res.status;
        const statusText =
          typeof (data as any).statusText === 'string'
            ? (data as any).statusText
            : res.statusText;
        const ok = typeof (data as any).ok === 'boolean' ? (data as any).ok : res.ok;
        const headersObj: Record<string, string> = {};
        if ((data as any).headers && typeof (data as any).headers === 'object') {
          for (const [k, v] of Object.entries(
            (data as any).headers as Record<string, unknown>,
          )) {
            if (typeof k === 'string' && typeof v === 'string') {
              headersObj[k] = v;
            }
          }
        }
        const rawBody =
          typeof (data as any).body === 'string'
            ? (data as any).body
            : JSON.stringify(data, null, 2);
        set((prev) => ({
          result: { ok, status, statusText, headers: headersObj, body: rawBody },
          error: ok ? null : `HTTP ${status} ${statusText}`,
          runStats: {
            total: prev.runStats.total + 1,
            statuses: [...prev.runStats.statuses, status],
          },
        }));
        return;
      }
      const text = JSON.stringify(data, null, 2);
      set((prev) => ({
        result: {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          headers: {},
          body: text,
        },
        error: res.ok ? null : `HTTP ${res.status} ${res.statusText}`,
        runStats: {
          total: prev.runStats.total + 1,
          statuses: [...prev.runStats.statuses, res.status],
        },
      }));
    } else {
      const text = await res.text().catch(() => '');
      set((prev) => ({
        result: {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          headers: {},
          body: text || '',
        },
        error: res.ok ? null : text || `HTTP ${res.status} ${res.statusText}`,
        runStats: {
          total: prev.runStats.total + 1,
          statuses: [...prev.runStats.statuses, res.status],
        },
      }));
    }
  } catch (e: any) {
    set(() => ({ error: e?.message || '执行失败' }));
  }
}

export const useCurlRunner = create<CurlRunnerState>((set, get) => ({
  isRunning: false,
  config: null,
  result: null,
  error: null,
  runStats: { total: 0, statuses: [] },

  stop: () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    set(() => ({ isRunning: false }));
  },

  start: (cfg: CurlRunnerConfig) => {
    // 清理旧定时器
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    const count = Math.max(
      1,
      Math.min(1000, Math.floor(Number(cfg.repeatCount) || 1)),
    );
    const interval = Math.max(
      500,
      Math.min(600000, Number(cfg.repeatIntervalMs) || 0),
    );

    set(() => ({
      config: cfg,
      isRunning: true,
      error: null,
      runStats: { total: 0, statuses: [] },
      result: null,
    }));

    let remaining = count;

    const runOnce = async () => {
      if (remaining <= 0) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        set(() => ({ isRunning: false }));
        return;
      }
      remaining -= 1;
      await executeOnce(cfg, (updater) => set((prev) => ({ ...prev, ...updater(prev) })));
      if (remaining <= 0) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        set(() => ({ isRunning: false }));
      }
    };

    // 先执行一次
    void runOnce();

    // repeat 模式才起 interval
    if (count > 1) {
      timer = setInterval(() => {
        void runOnce();
      }, interval);
    }
  },
}));

