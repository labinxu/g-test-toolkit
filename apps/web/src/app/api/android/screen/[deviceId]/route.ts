import { NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '../../_utils';

export async function GET(_req: NextRequest, { params }: { params: { deviceId: string } }) {
  const base = getBackendBase();
  if (!base) return NextResponse.json({ error: 'API_BASE_URL not set' }, { status: 503 });
  const url = `${base.replace(/\/$/, '')}/android/screen/${encodeURIComponent(params.deviceId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const arrayBuf = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  // Ensure proper content-type
  if (!headers.get('content-type')) headers.set('content-type', 'image/png');
  return new NextResponse(arrayBuf, { status: res.status, headers });
}

