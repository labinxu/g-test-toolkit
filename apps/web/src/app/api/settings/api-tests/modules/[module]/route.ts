import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ module: string }> },
) {
  const base =
    process.env.API_BASE_URL || process.env.INSPECTOR_BASE_URL || '';
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    );
  }

  const { module } = await context.params;
  const mod = (module || '').trim() || 'default';
  const url = `${base.replace(
    /\/$/,
    '',
  )}/settings/api-tests/modules/${encodeURIComponent(mod)}`;

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

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ module: string }> },
) {
  const base =
    process.env.API_BASE_URL || process.env.INSPECTOR_BASE_URL || '';
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    );
  }

  const { module } = await context.params;
  const mod = (module || '').trim() || 'default';
  const url = `${base.replace(
    /\/$/,
    '',
  )}/settings/api-tests/modules/${encodeURIComponent(mod)}`;

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
    method: 'PUT',
    headers,
    body: JSON.stringify(body || {}),
  } as any);

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json')
    ? await res.json()
    : await res.text();

  return NextResponse.json(data as any, { status: res.status });
}
