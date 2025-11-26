import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  const methodRaw = typeof body?.method === 'string' ? body.method : 'GET';
  const method = methodRaw.toUpperCase();
  const headersRaw = typeof body?.headers === 'string' ? body.headers : '';
  const payload = typeof body?.payload === 'string' ? body.payload : '';

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // 解析 headers 文本：期望是 JSON 对象字符串
  let headers: Record<string, string> | undefined;
  if (headersRaw.trim()) {
    try {
      const parsed = JSON.parse(headersRaw);
      if (parsed && typeof parsed === 'object') {
        headers = {};
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (typeof k === 'string' && typeof v === 'string') {
            headers[k] = v;
          }
        }
      }
    } catch {
      return NextResponse.json(
        { error: 'headers must be a valid JSON object of string:string' },
        { status: 400 },
      );
    }
  }

  const init: RequestInit = { method };
  if (headers && Object.keys(headers).length > 0) {
    init.headers = headers;
  }

  if (method !== 'GET' && payload.trim()) {
    // 不做二次 JSON.stringify，直接以文本形式发送
    init.body = payload;
  }

  const res = await fetch(url, init as any);
  const ct = res.headers.get('content-type') || '';
  let respBody: any;
  if (ct.includes('application/json')) {
    respBody = await res.json().catch(() => null);
  } else {
    respBody = await res.text().catch(() => '');
  }

  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    respHeaders[k] = v;
  });

  return NextResponse.json(
    {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: respHeaders,
      body: respBody,
    },
    { status: 200 },
  );
}

