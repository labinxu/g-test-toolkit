'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ChevronDown, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme } from 'next-themes'

const defaultScript = `/**
 * FAST USER DB calculator.
 * You can edit this script; it runs inside a Function(userId, cdate, previousResult).
 * Return any serialisable value (string/object) and it will appear in the output area.
 */
const seed = 10n;
const mask = 0x7fffffffffffffffn;

const normalizedUserId = String(userId ?? '').trim();
if (!normalizedUserId) {
  throw new Error('UserID is required');
}

const cdateBigInt = BigInt(cdate);
const cdateMod = Number(cdateBigInt % 10n);
const inputString = \`\${normalizedUserId}\${cdateMod}\`;

let hashValue = 0n;
for (let i = 0; i < inputString.length; i += 1) {
  hashValue = hashValue * seed + BigInt(inputString.charCodeAt(i));
}
hashValue &= mask;

const tableNumber = Number(hashValue % 200n);

return {
  userId: normalizedUserId,
  cdate: cdateBigInt.toString(),
  input: inputString,
  hash: hashValue.toString(),
  table: tableNumber.toString().padStart(3, '0'),
};`

const stringifyResult = (result: unknown) => {
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(
      result,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      2
    )
  } catch {
    return String(result ?? '')
  }
}

async function extractErrorMessage(res: Response, fallback: string) {
  try {
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = await res.json()
      const message = data?.message ?? data?.error
      if (Array.isArray(message)) {
        return message.join(', ')
      }
      if (typeof message === 'string' && message.length > 0) {
        return message
      }
      return fallback
    }
    const text = await res.text()
    return text || fallback
  } catch {
    return fallback
  }
}

async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' })
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as { token?: string }
    return data?.token ?? null
  } catch {
    return null
  }
}

export default function FastUserDbToolPage() {
  const [userId, setUserId] = useState('')
  const [cdate, setCdate] = useState('')
  const [script, setScript] = useState(defaultScript)
  const [lastSavedScript, setLastSavedScript] = useState(defaultScript)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(true)
  const [isFetchingScript, setIsFetchingScript] = useState(false)
  const userEditedRef = useRef(false)
  const [fetchedUserRaw, setFetchedUserRaw] = useState('')
  const { theme } = useTheme()

  const environments = useMemo(() => {
    return {
      qa1x: {
        label: 'QA1X',
        uinf: 'https://qa1-prod.gettr-qa.com/api/s/uinf/',
        fastUserApi: 'https://next-backend-notif.qa1.ue1.oke.gettr-qa.com/api/v1/fast-user',
      },
      qa4: {
        label: 'QA4',
        uinf: 'https://qa4.gettr-qa.com/api/s/uinf/',
        fastUserApi: 'https://next-backend-notif.qa4.ue1.oke.gettr-qa.com/api/v1/fast-user',
      },
    }
  }, [])
  const [qaEnv, setQaEnv] = useState(environments.qa1x)

  useEffect(() => {
    let cancelled = false
    const loadScript = async () => {
      setIsFetchingScript(true)
      try {
        const res = await fetch('/api/files/fast-user-db/script', {
          credentials: 'include',
        })
        if (!res.ok) {
          throw new Error(await extractErrorMessage(res, 'Failed to load script'))
        }
        const data = (await res.json()) as { content?: string }
        if (cancelled) return
        const remoteContent = typeof data?.content === 'string' ? data.content : ''
        const displayContent =
          remoteContent && remoteContent.trim().length > 0 ? remoteContent : defaultScript
        if (!userEditedRef.current) {
          setScript(displayContent)
        }
        setLastSavedScript(displayContent)
        setLoadError('')
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setLoadError(message)
        toast.error(`Loading failed: ${message}`)
      } finally {
        if (!cancelled) {
          setIsFetchingScript(false)
        }
      }
    }

    loadScript()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setIsDirty(script !== lastSavedScript)
  }, [script, lastSavedScript])

  const isUserReady = useMemo(() => userId.trim().length > 0, [userId])

  const codeMirrorExtensions = useMemo(() => [javascript({ jsx: true, typescript: true })], [])

  const handleScriptChange = useCallback((value: string) => {
    userEditedRef.current = true
    setScript(value)
  }, [])

  const fetchCdateForUser = useCallback(
    async (id: string) => {
      const endpoint = `${qaEnv.uinf}/${encodeURIComponent(id)}`
      const res = await fetch(endpoint, { method: 'GET' })
      if (!res.ok) {
        const fallback = await res.text()
        throw new Error(fallback || `Failed to fetch CDATE for ${id}`)
      }
      const data = await res.json()
      const fetched = data?.result?.data?.cdate
      if (fetched === undefined || fetched === null || fetched === '') {
        throw new Error('CDATE not found in response')
      }
      return {
        cdate: String(fetched),
        raw: data,
      }
    },
    [qaEnv]
  )

  const handleCalculate = useCallback(async () => {
    const trimmedUserId = userId.trim()
    setFetchedUserRaw('')
    if (!trimmedUserId) {
      setError('User ID is required')
      setOutput('')
      return
    }
    setIsRunning(true)
    try {
      let effectiveCdate = cdate.trim()
      if (!effectiveCdate) {
        const response = await fetchCdateForUser(trimmedUserId)
        effectiveCdate = response.cdate
        setCdate(effectiveCdate)
        setFetchedUserRaw(stringifyResult(response.raw))
      }
      const runner = new Function('userId', 'cdate', 'previousResult', script) as (
        userId: string,
        cdate: string,
        previousResult: string
      ) => unknown
      const rawResult = runner(trimmedUserId, effectiveCdate, output)
      setOutput(stringifyResult(rawResult))
      setError('')
    } catch (err: unknown) {
      setOutput('')
      setError(err instanceof Error ? err.message : String(err))
      setFetchedUserRaw('')
    } finally {
      setIsRunning(false)
    }
  }, [cdate, fetchCdateForUser, output, script, userId])

  const handleApplyAddUserId = useCallback(async () => {
    const trimmed = userId.trim()

    if (!trimmed) {
      toast.error('Please enter a User ID to add')
      return
    }
    setIsRunning(true)
    try {
      const response = await fetch('/api/commands/fastuser/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: trimmed, url: qaEnv.fastUserApi }),
      })

      const data = await response.json()
      if (response.ok && data.status === 'OK') {
        toast.success(`Added Fast User ID ${trimmed} successful`)
      } else {
        toast.error(`Added Fast User ID ${trimmed} failed`)
      }
    } finally {
      setIsRunning(false)
    }
    setUserId(userId)
  }, [userId, qaEnv])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/files/fast-user-db/script', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ content: script }),
      })
      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, 'Failed to save script'))
      }
      await res.json()
      setLastSavedScript(script)
      userEditedRef.current = false
      toast.success('Saved')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`Save Failed: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }, [script])

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-6 overflow-y-auto rounded-lg border-2 p-6 shadow-lg">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">FastUserInfo</h1>
        <p className="text-muted-foreground text-sm">
          Enter UserID and CDATE, optionally tweak the script, then run Calculate to see the shard.
        </p>
        {loadError && (
          <p className="text-destructive text-sm">Failed to load script: {loadError}</p>
        )}
      </div>

      <div className="bg-muted/20 w-full rounded-lg border p-4">
        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fast-user-db-environment" className="text-sm font-medium">
              Environment
            </Label>

            <Select
              defaultValue="qa1x"
              onValueChange={(value) => {
                setQaEnv(environments[value])
              }}
            >
              <SelectTrigger
                id="fast-user-db-environment"
                className="h-10 w-full justify-between rounded-md border px-3 py-1.5 text-sm"
              >
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="max-h-[160px] w-[160px] overflow-y-auto">
                {Object.keys(environments).map((key) => (
                  <SelectItem key={key} value={key}>
                    {environments[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fast-user-db-user-id" className="text-sm font-medium">
              User ID
            </Label>
            <Input
              id="fast-user-db-user-id"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Enter user ID"
              className="h-10 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fast-user-db-cdate" className="text-sm font-medium">
              CDATE
            </Label>
            <Input
              id="fast-user-db-cdate"
              value={cdate}
              onChange={(event) => setCdate(event.target.value)}
              placeholder="Enter created time (numeric)"
              className="h-10 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3 lg:self-end">
            <Button
              disabled={!isUserReady || isRunning}
              className="h-10 w-full px-4 sm:w-auto"
              variant="secondary"
              onClick={handleCalculate}
            >
              {isRunning ? 'Running...' : 'Calculate'}
            </Button>
            <Button
              disabled={!isUserReady || isRunning}
              className="h-10 w-full px-4 sm:w-auto"
              variant="secondary"
              onClick={handleApplyAddUserId}
            >
              {isRunning ? 'Running...' : 'AddFast'}
            </Button>
          </div>
        </div>
      </div>
      {error && <span className="text-destructive text-sm">{error}</span>}

      <div className="flex w-full flex-col gap-3 overflow-hidden rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">JavaScript (collapsible & saveable)</p>
            <p className="text-muted-foreground text-xs">
              Stored at workspace/scripts/fast-user-db.js
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                'Saving...'
              ) : (
                <>
                  <Save className="mr-1 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setScriptOpen((prev) => !prev)}
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', scriptOpen ? 'rotate-180' : '')}
              />
              <span className="ml-1 text-xs">{scriptOpen ? 'Collapse' : 'Expand'}</span>
            </Button>
          </div>
        </div>
        {scriptOpen && (
          <div className="w-full overflow-hidden rounded-md border">
            <CodeMirror
              value={script}
              height="280px"
              minHeight="220px"
              maxHeight="300px"
              extensions={codeMirrorExtensions}
              editable={!isSaving && !isFetchingScript}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                bracketMatching: true,
                autocompletion: true,
              }}
              onChange={(value) => handleScriptChange(value)}
              theme={theme === 'dark' ? 'dark' : 'light'}
              className="w-full text-sm"
            />
          </div>
        )}
      </div>

      <div className="grid w-full gap-4 rounded-lg border p-4 sm:grid-cols-1 md:grid-cols-2">
        <div className="bg-muted/20 flex flex-col gap-2 rounded-md border p-3">
          <Label htmlFor="fast-user-db-fetch-response" className="text-sm font-medium">
            User Fetch Response
          </Label>
          <Textarea
            id="fast-user-db-fetch-response"
            readOnly
            value={fetchedUserRaw}
            placeholder="GET /api/s/uinf response will appear here"
            className="h-[9.5rem] w-full overflow-auto font-mono text-sm"
          />
        </div>
        <div className="bg-muted/20 flex flex-col gap-2 rounded-md border p-3">
          <Label htmlFor="fast-user-db-output" className="text-sm font-medium">
            Hash Result
          </Label>
          <Textarea
            id="fast-user-db-output"
            readOnly
            value={output}
            placeholder="Hash result will appear here"
            className="h-[9.5rem] w-full overflow-auto font-mono text-sm"
          />
        </div>
      </div>
    </div>
  )
}
