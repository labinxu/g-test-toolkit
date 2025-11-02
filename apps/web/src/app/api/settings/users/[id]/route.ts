import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../android/_utils'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params?.id
  return proxyJsonWithReq(req, `/settings/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params?.id
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, `/settings/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
}
