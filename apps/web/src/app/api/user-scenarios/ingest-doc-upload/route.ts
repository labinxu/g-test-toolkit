import { NextRequest, NextResponse } from 'next/server'
import { getBackendBase, withForwardedAuth } from '../../android/_utils'

export async function POST(req: NextRequest) {
  const base = getBackendBase()
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    )
  }
  const form = await req.formData()
  const url = `${base.replace(/\/$/, '')}/user-scenarios/ingest-doc-upload`
  const res = await fetch(url, {
    method: 'POST',
    headers: withForwardedAuth(req) as any,
    body: form as any,
  })
  const ct = res.headers.get('content-type') || ''
  const body = ct.includes('application/json') ? await res.json() : await res.text()
  return NextResponse.json(body as any, { status: res.status })
}
