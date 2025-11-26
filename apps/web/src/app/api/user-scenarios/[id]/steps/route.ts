import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../android/_utils'

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const id = context.params.id
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, `/user-scenarios/${encodeURIComponent(id)}/steps`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

