import { NextRequest, NextResponse } from 'next/server';

export function getBackendBase() {
  return process.env.API_BASE_URL || process.env.INSPECTOR_BASE_URL || '';
}

export function withForwardedAuth(
  req?: NextRequest,
  extra?: HeadersInit,
): HeadersInit | undefined {
  const headers: Record<string, string> = {};
  if (req) {
    const cookie = req.headers.get('cookie');
    const auth = req.headers.get('authorization');
    if (cookie) headers['cookie'] = cookie;
    if (auth) headers['authorization'] = auth;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra as any)) {
      headers[k] = v as string;
    }
  }
  return Object.keys(headers).length ? headers : undefined;
}

export async function proxyJson(path: string, init?: RequestInit) {
  const base = getBackendBase();
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    );
  }
  const url = `${base.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, { cache: 'no-store', ...init });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  return NextResponse.json(body as any, { status: res.status });
}

export async function proxyJsonWithReq(req: NextRequest, path: string, init?: RequestInit) {
  const base = getBackendBase();
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    );
  }
  const url = `${base.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: withForwardedAuth(req, init?.headers as any),
  });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  return NextResponse.json(body as any, { status: res.status });
}
