import { NextResponse } from 'next/server';
import { getBackendBase } from '../../_utils';

export async function GET(_req: Request, context: any) {
  const base = getBackendBase();
  if (!base) return NextResponse.json({ error: 'API_BASE_URL not set' }, { status: 503 });
  const url = `${base.replace(/\/$/, '')}/android/screen/${encodeURIComponent(context?.params?.deviceId as string)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const arrayBuf = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  // Ensure proper content-type
  if (!headers.get('content-type')) headers.set('content-type', 'image/png');
  return new NextResponse(arrayBuf, { status: res.status, headers });
}
