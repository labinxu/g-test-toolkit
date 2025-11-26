import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const base =
    process.env.API_BASE_URL || process.env.INSPECTOR_BASE_URL || '';
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    );
  }

  const url = `${base.replace(/\/$/, '')}/api-tests/core-be/schema`;

  const headers: Record<string, string> = {};
  const cookie = req.headers.get('cookie');
  const auth = req.headers.get('authorization');
  if (cookie) headers.cookie = cookie;
  if (auth) headers.authorization = auth;

  const res = await fetch(url, {
    cache: 'no-store',
    method: 'GET',
    headers,
  } as any);

  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json')
    ? await res.json()
    : await res.text();
  return NextResponse.json(body as any, { status: res.status });
}
