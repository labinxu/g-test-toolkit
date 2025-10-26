import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../android/_utils';

// Proxy to NestJS Inspector service with auth forwarding
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  const path = `/inspector/snapshot${qs ? `?${qs}` : ''}`;
  return proxyJsonWithReq(req, path, { method: 'GET' });
}
