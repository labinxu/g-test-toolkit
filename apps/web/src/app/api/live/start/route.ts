import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function POST(req: NextRequest) {
  const bodyText = await req.text()
  return proxyJsonWithReq(req, '/live/start', {
    method: 'POST',
    body: bodyText,
    headers: {
      'content-type': 'application/json',
    },
  })
}

