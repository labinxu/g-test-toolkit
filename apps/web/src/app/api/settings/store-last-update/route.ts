import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '@/app/api/android/_utils'

export async function GET(req: NextRequest) {
  return proxyJsonWithReq(req, '/settings/store-last-update', { method: 'GET' })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, '/settings/store-last-update', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

