import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../android/_utils'

export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, `/action-catalog/platforms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id
  return proxyJsonWithReq(req, `/action-catalog/platforms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

