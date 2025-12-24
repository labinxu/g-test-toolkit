import { NextRequest, NextResponse } from 'next/server';

import { getBackendBase, withForwardedAuth } from '../../../android/_utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ branch: string }> },
) {
  try {
    const base = getBackendBase();
    if (!base) {
      return NextResponse.json(
        { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
        { status: 503 },
      );
    }

    const { branch } = await params;
    const sanitizedBranch = encodeURIComponent(branch || '');
    const url = `${base.replace(/\/$/, '')}/flutter/meta/${sanitizedBranch}`;
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
    const message =
      e?.message || 'Load Flutter metadata for branch failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
