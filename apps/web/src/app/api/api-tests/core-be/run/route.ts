import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const base =
    process.env.API_BASE_URL || process.env.INSPECTOR_BASE_URL || '';
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    );
  }

  const url = `${base.replace(/\/$/, '')}/api-tests/core-be/run`;
  const body = await req.json().catch(() => ({}));

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  const cookie = req.headers.get('cookie');
  const auth = req.headers.get('authorization');
  const csrf = req.headers.get('x-csrf-token');
  if (cookie) headers.cookie = cookie;
  if (auth) headers.authorization = auth;
  if (csrf) headers['x-csrf-token'] = csrf;

  const res = await fetch(url, {
    cache: 'no-store',
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  } as any);

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json')
    ? await res.json()
    : await res.text();

  return NextResponse.json(data as any, { status: res.status });
}

