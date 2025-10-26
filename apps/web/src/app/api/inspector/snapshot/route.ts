import { NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '../../android/_utils';

// Proxy to NestJS Inspector service with auth forwarding
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const base = getBackendBase();
  if (!base) return NextResponse.json({ error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' }, { status: 503 });
  const url = `${base.replace(/\/$/, '')}/inspector/snapshot${qs ? `?${qs}` : ''}`;

  // Forward auth headers (cookie + authorization) if present
  const fwdHeaders: Record<string, string> = {};
  const cookie = req.headers.get('cookie');
  const auth = req.headers.get('authorization');
  if (cookie) fwdHeaders['cookie'] = cookie;
  if (auth) fwdHeaders['authorization'] = auth;

  let lastStatus = 502;
  let lastBody: any = { error: 'Upstream request failed' };
  const RETRY_DELAY_MS = 200;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'GET', cache: 'no-store', headers: Object.keys(fwdHeaders).length ? fwdHeaders : undefined });
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();
      if (res.ok) {
        return NextResponse.json(body as any, { status: res.status });
      }
      lastStatus = res.status;
      lastBody = body;
    } catch (e: any) {
      lastStatus = 502;
      lastBody = { error: e?.message || 'Upstream request failed' };
    }
    // short delay before next retry (except after last attempt)
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  return NextResponse.json(
    typeof lastBody === 'string' ? { error: lastBody } : lastBody,
    { status: lastStatus || 500 }
  );
}
