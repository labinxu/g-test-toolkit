import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const qs = url.searchParams.toString()
  const path = qs
    ? `/user-scenarios/action-catalog?${qs}`
    : '/user-scenarios/action-catalog'
  return proxyJsonWithReq(req, path, { method: 'GET' })
}

