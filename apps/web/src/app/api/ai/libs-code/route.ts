import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function POST(req: NextRequest) {
  let body: any = null
  try {
    body = await req.json()
  } catch {}
  return proxyJsonWithReq(req, '/ai/generate-libs-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
}

