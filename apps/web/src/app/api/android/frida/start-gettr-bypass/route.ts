import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../_utils';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyJsonWithReq(req, '/android/frida/start-gettr-bypass', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

