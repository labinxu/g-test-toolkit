import { NextRequest } from 'next/server';
import { proxyJsonWithReq } from '../../android/_utils';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return proxyJsonWithReq(request, '/inspector/tap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}
