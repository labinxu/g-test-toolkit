import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../_utils';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = url.searchParams.get('limit') || undefined;
  const path = limit ? `/android/mitm/flows?limit=${encodeURIComponent(limit)}` : '/android/mitm/flows';
  return proxyJsonWithReq(req, path, { method: 'GET' });
}

