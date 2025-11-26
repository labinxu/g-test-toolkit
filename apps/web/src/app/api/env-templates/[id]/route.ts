import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  const path = `/env-templates/${encodeURIComponent(id)}`
  return proxyJsonWithReq(req, path, {
    method: 'PATCH',
    body: await req.text(),
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
    },
  })
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  const path = `/env-templates/${encodeURIComponent(id)}`
  return proxyJsonWithReq(req, path, { method: 'DELETE' })
}

