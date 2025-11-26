import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../android/_utils'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const qs = url.searchParams.toString()
  const path = qs ? `/user-scenarios?${qs}` : '/user-scenarios'
  return proxyJsonWithReq(req, path, { method: 'GET' })
}

export async function POST(req: NextRequest) {
  return proxyJsonWithReq(req, '/user-scenarios', {
    method: 'POST',
    body: await req.text(),
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
    },
  })
}
