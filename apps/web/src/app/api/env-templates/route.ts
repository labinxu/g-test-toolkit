import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../android/_utils'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const qs = url.searchParams.toString()
  const path = qs ? `/env-templates?${qs}` : '/env-templates'
  return proxyJsonWithReq(req, path, { method: 'GET' })
}

export async function POST(req: NextRequest) {
  return proxyJsonWithReq(req, '/env-templates', {
    method: 'POST',
    body: await req.text(),
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
    },
  })
}
