import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../android/_utils'

export async function GET(req: NextRequest) {
  return proxyJsonWithReq(req, '/actors', { method: 'GET' })
}

export async function POST(req: NextRequest) {
  return proxyJsonWithReq(req, '/actors', {
    method: 'POST',
    body: await req.text(),
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
    },
  })
}

