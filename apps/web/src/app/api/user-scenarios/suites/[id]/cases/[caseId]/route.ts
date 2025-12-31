import { NextRequest } from 'next/server'
import { proxyJsonWithReq } from '../../../../../android/_utils'

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; caseId: string }> },
) {
  const { id, caseId } = await context.params
  return proxyJsonWithReq(
    req,
    `/user-scenarios/suites/${encodeURIComponent(id)}/cases/${encodeURIComponent(caseId)}`,
    {
      method: 'DELETE',
    },
  )
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; caseId: string }> },
) {
  const { id, caseId } = await context.params
  return proxyJsonWithReq(
    req,
    `/user-scenarios/suites/${encodeURIComponent(id)}/cases/${encodeURIComponent(caseId)}`,
    {
      method: 'PUT',
      body: await req.text(),
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
      },
    },
  )
}
