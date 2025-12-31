import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../android/_utils'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return proxyJsonWithReq(req, `/actors/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: await req.text(),
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
    },
  })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return proxyJsonWithReq(req, `/actors/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

