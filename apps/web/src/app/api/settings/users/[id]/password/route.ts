import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../../android/_utils'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params?.id
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, `/settings/users/${encodeURIComponent(id)}/password`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
}

