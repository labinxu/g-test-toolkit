export type NormalizedApiError = {
  status?: number
  code?: string
  message: string
  details?: any
  fieldErrors?: Record<string, string>
}

function extractFieldErrors(body: any): Record<string, string> | undefined {
  try {
    if (!body || typeof body !== 'object') return undefined
    const candidate = (body.errors || (typeof body.message === 'object' ? body.message : undefined)) as
      | Record<string, any>
      | undefined
    if (!candidate || typeof candidate !== 'object') return undefined
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(candidate)) {
      if (v == null) continue
      if (Array.isArray(v)) out[k] = v.filter(Boolean).join(', ')
      else out[k] = String(v)
    }
    return Object.keys(out).length ? out : undefined
  } catch {
    return undefined
  }
}

async function parseBody(res: Response): Promise<any | string | undefined> {
  const ct = res.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) return await res.json()
    const text = await res.text()
    return text
  } catch {
    return undefined
  }
}

function pickMessage(body: any, fallback?: string): string {
  try {
    if (typeof body === 'string' && body.trim()) return body
    if (body && typeof body === 'object') {
      if (typeof body.message === 'string' && body.message.trim()) return body.message
      if (Array.isArray(body.message)) return body.message.filter(Boolean).join('; ')
      if (typeof body.error === 'string' && body.error.trim()) return body.error
      if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
    }
  } catch {
    // ignore
  }
  return fallback || 'Request failed'
}

export async function normalizeResponseError(res: Response): Promise<NormalizedApiError> {
  const body = await parseBody(res)
  const statusLine = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`.trim()
  const message = pickMessage(body, statusLine)
  let fieldErrors = extractFieldErrors(body)
  // Heuristic: map common Nest ValidationPipe messages (array of strings) to field names
  try {
    if (!fieldErrors && body && typeof body === 'object' && Array.isArray((body as any).message)) {
      const msgs = (body as any).message as any[]
      const map: Record<string, string[]> = {}
      const candidates = ['username', 'email', 'password', 'confirmPassword']
      for (const m of msgs) {
        const s = String(m || '')
        for (const f of candidates) {
          const lower = s.toLowerCase()
          if (lower.startsWith(f.toLowerCase() + ' ') || lower.includes(`${f.toLowerCase()} `)) {
            if (!map[f]) map[f] = []
            map[f].push(s)
            break
          }
        }
      }
      const flat: Record<string, string> = {}
      for (const [k, arr] of Object.entries(map)) {
        if (arr.length) flat[k] = arr.join(', ')
      }
      fieldErrors = Object.keys(flat).length ? flat : undefined
    }
  } catch {}
  const code = (body && typeof body === 'object' && (body.code as string)) || undefined
  return {
    status: res.status,
    code,
    message,
    details: body,
    fieldErrors,
  }
}

export function normalizeThrownError(err: unknown): NormalizedApiError {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as any
    return {
      message: typeof e.message === 'string' ? e.message : 'Unknown error',
      code: typeof e.code === 'string' ? e.code : undefined,
      details: e,
    }
  }
  try {
    return { message: JSON.stringify(err) }
  } catch {
    return { message: String(err) }
  }
}

// Apply field-level backend validation errors onto a react-hook-form instance.
// Safe no-op if keys don't match or form isn't RHF. Keeps UI inline with server.
export function applyFieldErrors<TForm extends { setError?: Function }>(
  form: TForm,
  fieldErrors?: Record<string, string> | null | undefined
) {
  if (!form || typeof form !== 'object' || !fieldErrors) return
  const setError = (form as any)?.setError as
    | ((name: string, error: { type?: string; message?: string }) => void)
    | undefined
  if (!setError) return
  for (const [name, msg] of Object.entries(fieldErrors)) {
    try {
      setError(name, { type: 'server', message: String(msg ?? '') })
    } catch {
      // ignore mapping errors (unknown field keys)
    }
  }
}

// Error type helper for throwing with extra fields (status/fieldErrors)
export type EnrichedError = Error & { status?: number; code?: string; fieldErrors?: Record<string, string> }
