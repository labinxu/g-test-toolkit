import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../android/_utils'

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  const id = context.params.id
  return proxyJsonWithReq(req, `/user-scenarios/${encodeURIComponent(id)}/generate-code`, {
    method: 'POST',
  })
}

