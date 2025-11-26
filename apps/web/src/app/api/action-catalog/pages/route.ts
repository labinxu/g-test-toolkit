import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const qs = url.searchParams.toString()
  const path = qs ? `/action-catalog/pages?${qs}` : '/action-catalog/pages'
  return proxyJsonWithReq(req, path, { method: 'GET' })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, '/action-catalog/pages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

