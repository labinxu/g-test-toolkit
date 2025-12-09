import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString()
  const path = qs ? `/user-scenarios/suites?${qs}` : '/user-scenarios/suites'
  return proxyJsonWithReq(req, path, {
    method: 'GET',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, '/user-scenarios/suites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}
