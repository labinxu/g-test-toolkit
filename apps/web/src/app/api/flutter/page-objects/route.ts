import { NextRequest, NextResponse } from 'next/server';

import { getBackendBase, withForwardedAuth } from '../../android/_utils';

export async function POST(req: NextRequest) {
  try {
    const base = getBackendBase();
    if (!base) {
      return NextResponse.json(
        { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
        { status: 503 },
      );
    }

    const meta = await req.json();
    const url = `${base.replace(/\/$/, '')}/flutter/page-objects`;

    const headers = withForwardedAuth(req, {
      'content-type': 'application/json',
    });

    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(meta),
      headers: headers as any,
    } as any);

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json()
      : await res.text();

    return NextResponse.json(data as any, { status: res.status });
  } catch (e: any) {
    const message =
      e?.message || 'Generate Flutter page objects from metadata failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

