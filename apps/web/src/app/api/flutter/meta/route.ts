import { NextRequest, NextResponse } from 'next/server';

import { getBackendBase, withForwardedAuth } from '../../android/_utils';

export async function GET(req: NextRequest) {
  try {
    const base = getBackendBase();
    if (!base) {
      return NextResponse.json(
        { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
        { status: 503 },
      );
    }

    const url = `${base.replace(/\/$/, '')}/flutter/meta`;
    const headers = withForwardedAuth(req);

    const res = await fetch(url, {
      method: 'GET',
      headers: headers as any,
      cache: 'no-store',
    } as any);

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json()
      : await res.text();

    return NextResponse.json(data as any, { status: res.status });
  } catch (e: any) {
    const message = e?.message || 'List Flutter metadata files failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

