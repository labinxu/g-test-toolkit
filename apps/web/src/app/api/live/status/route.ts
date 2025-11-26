import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function GET(req: NextRequest) {
  return proxyJsonWithReq(req, '/live/status', {
    method: 'GET',
  })
}

