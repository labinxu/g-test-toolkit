import { NextRequest } from 'next/server';

import { proxyJsonWithReq } from '../../android/_utils';

export async function GET(req: NextRequest) {
  return proxyJsonWithReq(req, '/settings/curl-payloads', { method: 'GET' });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyJsonWithReq(req, '/settings/curl-payloads', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

