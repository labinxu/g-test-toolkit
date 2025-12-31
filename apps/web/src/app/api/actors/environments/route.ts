import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function GET(req: NextRequest) {
  return proxyJsonWithReq(req, '/actors/environments', { method: 'GET' })
}

