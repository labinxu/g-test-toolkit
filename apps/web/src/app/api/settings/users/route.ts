import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, '/settings/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
}

