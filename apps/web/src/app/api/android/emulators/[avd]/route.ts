import { NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '../../_utils';

export async function DELETE(req: NextRequest, { params }: { params: { avd: string } }) {
  const base = getBackendBase();
  if (!base) return NextResponse.json({ error: 'API_BASE_URL not set' }, { status: 503 });
  const avd = params.avd;
  const url = `${base.replace(/\/$/, '')}/android/emulators/${encodeURIComponent(avd)}`;
  const headers: HeadersInit = {};
  const cookie = req.headers.get('cookie');
  const auth = req.headers.get('authorization');
  if (cookie) (headers as any)['cookie'] = cookie;
  if (auth) (headers as any)['authorization'] = auth;
  const res = await fetch(url, { method: 'DELETE', cache: 'no-store', headers });
  const data = await res.json().catch(async () => ({ error: await res.text() }));
  return NextResponse.json(data as any, { status: res.status });
}
