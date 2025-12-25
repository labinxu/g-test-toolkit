import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../../android/_utils'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  return proxyJsonWithReq(req, `/user-scenarios/suites/${encodeURIComponent(id)}/cases`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

