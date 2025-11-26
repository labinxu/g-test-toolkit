import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function GET(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const id = context.params.id
  return proxyJsonWithReq(req, `/user-scenarios/${encodeURIComponent(id)}`, {
    method: 'GET',
  })
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const id = context.params.id
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, `/user-scenarios/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const id = context.params.id
  return proxyJsonWithReq(req, `/user-scenarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
