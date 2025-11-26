import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../_utils';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = url.searchParams.get('limit') || undefined;
  const path = limit
    ? `/android/frida/log?limit=${encodeURIComponent(limit)}`
    : '/android/frida/log';
  return proxyJsonWithReq(req, path, {
    method: 'GET',
  });
}

