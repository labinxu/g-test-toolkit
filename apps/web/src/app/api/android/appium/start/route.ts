import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../_utils';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyJsonWithReq(req, '/android/appium/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}
