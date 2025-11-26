import { NextRequest, NextResponse } from 'next/server'
import { getBackendBase, withForwardedAuth } from '../../android/_utils'

export async function POST(req: NextRequest) {
  let body: any = null
  try {
    body = await req.json()
  } catch {}
  const base = getBackendBase()
  if (!base) {
    return NextResponse.json(
      { error: 'API_BASE_URL or INSPECTOR_BASE_URL not set' },
      { status: 503 },
    )
  }
  const url = `${base.replace(/\/$/, '')}/testcase/stop`
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    const csrf = req.headers.get('x-csrf-token')
    if (csrf) {
      headers['x-csrf-token'] = csrf
    }
    const res = await fetch(url, {
      cache: 'no-store',
      method: 'POST',
      headers: withForwardedAuth(req, headers) as any,
      body: JSON.stringify(body || {}),
    } as any)
    const ct = res.headers.get('content-type') || ''
    const data = ct.includes('application/json') ? await res.json() : await res.text()
    return NextResponse.json(data as any, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Stop request failed' }, { status: 500 })
  }
}
