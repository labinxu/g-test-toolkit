import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function POST(req: NextRequest) {
  return proxyJsonWithReq(req, '/live/stop', {
    method: 'POST',
  })
}

