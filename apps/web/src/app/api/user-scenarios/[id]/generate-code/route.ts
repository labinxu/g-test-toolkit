import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../android/_utils'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return proxyJsonWithReq(req, `/user-scenarios/${encodeURIComponent(id)}/generate-code`, {
    method: 'POST',
  })
}
