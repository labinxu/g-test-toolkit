'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SocketProvider, useSocket } from '../../testcases/socket-content'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import { Loader2, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'

type AuthAccount = {
  id: string
  label?: string | null
  username: string
  password: string
  notes?: string | null
}

type CookieFile = {
  name: string
  path: string
  size?: number | null
  updatedAt?: string | null
}

async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    return data?.token ?? null
  } catch {
    return null
  }
}

export default function AuthResourcePage() {
  return (
    <SocketProvider>
      <AuthResourcePageInner />
    </SocketProvider>
  )
}

function AuthResourcePageInner() {
  const router = useRouter()
  const { clientId, connected, logs, clearLogs } = useSocket()

  const [accounts, setAccounts] = useState<AuthAccount[]>([])
  const [accountsPath, setAccountsPath] = useState<string>('')
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [savingAccounts, setSavingAccounts] = useState(false)

  const [cookieFiles, setCookieFiles] = useState<CookieFile[]>([])
  const [cookieDir, setCookieDir] = useState<string>('')
  const [loadingCookies, setLoadingCookies] = useState(false)

  const [recording, setRecording] = useState(false)
  const [recordAccountId, setRecordAccountId] = useState<string>('')
  const [recordDomain, setRecordDomain] = useState<string>('')
  const [recordHeadless, setRecordHeadless] = useState<boolean>(false)

  const recordAccount = useMemo(
    () => accounts.find((a) => a.id === recordAccountId) || null,
    [accounts, recordAccountId],
  )

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true)
      const res = await fetch('/api/auth-assets/accounts', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          router.push('/signin')
          return
        }
        throw new Error(err.message || 'Failed to load accounts')
      }
      const data = (await res.json()) as { items?: AuthAccount[]; path?: string }
      setAccounts(Array.isArray(data?.items) ? data.items : [])
      setAccountsPath((data?.path || '').toString())
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load accounts')
    } finally {
      setLoadingAccounts(false)
    }
  }

  const saveAccounts = async () => {
    try {
      setSavingAccounts(true)
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/auth-assets/accounts', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ items: accounts }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          router.push('/signin')
          return
        }
        throw new Error(err.message || 'Failed to save accounts')
      }
      const data = (await res.json()) as { items?: AuthAccount[]; path?: string }
      setAccounts(Array.isArray(data?.items) ? data.items : accounts)
      setAccountsPath((data?.path || '').toString())
      toast.success('Accounts saved')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save accounts')
    } finally {
      setSavingAccounts(false)
    }
  }

  const loadCookies = async () => {
    try {
      setLoadingCookies(true)
      const res = await fetch('/api/auth-assets/cookies', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          router.push('/signin')
          return
        }
        throw new Error(err.message || 'Failed to load cookies list')
      }
      const data = (await res.json()) as { items?: CookieFile[]; dir?: string }
      setCookieFiles(Array.isArray(data?.items) ? data.items : [])
      setCookieDir((data?.dir || '').toString())
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load cookies list')
    } finally {
      setLoadingCookies(false)
    }
  }

  const recordCookies = async () => {
    if (!clientId) {
      toast.error('WebSocket not connected; please wait and retry')
      return
    }
    if (!recordAccountId) {
      toast.error('请选择账号')
      return
    }
    if (!recordDomain.trim()) {
      toast.error('请输入 domain（例如 https://qa12.gettr-qa.com）')
      return
    }
    try {
      setRecording(true)
      clearLogs()
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/auth-assets/cookies/record', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({
          clientId,
          accountId: recordAccountId,
          domain: recordDomain.trim(),
          headless: recordHeadless,
        }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          router.push('/signin')
          return
        }
        throw new Error(err.message || 'Failed to start cookie recording')
      }
      toast.success(`Started recording cookies for ${recordAccountId}`)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start cookie recording')
    } finally {
      setRecording(false)
    }
  }

  useEffect(() => {
    void loadAccounts()
    void loadCookies()
  }, [])

  useEffect(() => {
    if (recordAccountId && !recordDomain) {
      try {
        const last = localStorage.getItem('gtt:auth-assets:lastDomain') || ''
        if (last) setRecordDomain(last)
      } catch {}
    }
  }, [recordAccountId, recordDomain])

  useEffect(() => {
    if (!recordDomain) return
    try {
      localStorage.setItem('gtt:auth-assets:lastDomain', recordDomain)
    } catch {}
  }, [recordDomain])

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Auth Assets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          账号信息与 cookies 存放在 `workspace/users/&lt;user&gt;/auth`（本地明文，仅用于测试账号）。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Accounts</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              `id` 建议使用 `user1`/`user2` 之类（仅字母/数字/`_`/`-`）。
            </p>
            {accountsPath ? (
              <p className="text-muted-foreground mt-1 text-xs">保存路径：{accountsPath}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadAccounts()}
              disabled={loadingAccounts}
            >
              {loadingAccounts ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1 h-4 w-4" />}
              刷新
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const nextId = `user${accounts.length + 1}`
                setAccounts((prev) => [
                  ...prev,
                  { id: nextId, label: nextId, username: '', password: '' },
                ])
                setRecordAccountId((prev) => prev || nextId)
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              新增
            </Button>
            <Button type="button" size="sm" onClick={() => void saveAccounts()} disabled={savingAccounts}>
              {savingAccounts ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              保存
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">id</TableHead>
                <TableHead className="w-[180px]">label</TableHead>
                <TableHead>username</TableHead>
                <TableHead>password</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length ? (
                accounts.map((acc, idx) => (
                  <TableRow key={`${acc.id}-${idx}`}>
                    <TableCell>
                      <Input
                        value={acc.id}
                        onChange={(e) => {
                          const v = e.target.value
                          setAccounts((prev) => prev.map((a, i) => (i === idx ? { ...a, id: v } : a)))
                          if (recordAccountId === acc.id) setRecordAccountId(v)
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={acc.label ?? ''}
                        onChange={(e) =>
                          setAccounts((prev) => prev.map((a, i) => (i === idx ? { ...a, label: e.target.value } : a)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={acc.username}
                        onChange={(e) =>
                          setAccounts((prev) => prev.map((a, i) => (i === idx ? { ...a, username: e.target.value } : a)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={acc.password}
                        type="password"
                        onChange={(e) =>
                          setAccounts((prev) => prev.map((a, i) => (i === idx ? { ...a, password: e.target.value } : a)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setAccounts((prev) => prev.filter((_, i) => i !== idx))
                          if (recordAccountId === acc.id) setRecordAccountId('')
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-sm">
                    暂无账号。点击“新增”添加，然后“保存”。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Cookies</CardTitle>
            {cookieDir ? <p className="text-muted-foreground mt-1 text-xs">目录：{cookieDir}</p> : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadCookies()} disabled={loadingCookies}>
            {loadingCookies ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1 h-4 w-4" />}
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">账号</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={recordAccountId}
                onChange={(e) => setRecordAccountId(e.target.value)}
              >
                <option value="">请选择</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} {a.label ? `(${a.label})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">domain</Label>
              <Input
                value={recordDomain}
                onChange={(e) => setRecordDomain(e.target.value)}
                placeholder="https://qa12.gettr-qa.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headless</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recordHeadless}
                  onChange={(e) => setRecordHeadless(e.target.checked)}
                />
                {recordHeadless ? '开启' : '关闭'}
              </label>
            </div>
            <div className="flex items-end md:col-span-2">
              <Button
                type="button"
                onClick={() => void recordCookies()}
                disabled={recording || !connected || !recordAccount}
              >
                {recording ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                录制 cookies（自动 UI 登录）
              </Button>
              <p className="text-muted-foreground ml-3 text-xs">
                {connected ? `WebSocket: ${clientId}` : 'WebSocket 未连接'}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>file</TableHead>
                <TableHead className="w-[120px]">updated</TableHead>
                <TableHead className="w-[100px]">size</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cookieFiles.length ? (
                cookieFiles.map((f) => (
                  <TableRow key={f.path}>
                    <TableCell className="font-mono text-xs">{f.name}</TableCell>
                    <TableCell className="text-xs">{f.updatedAt ? new Date(f.updatedAt).toLocaleString() : '-'}</TableCell>
                    <TableCell className="text-xs">{typeof f.size === 'number' ? `${f.size}` : '-'}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => window.open(`/api/files/raw?path=${encodeURIComponent(f.path)}`, '_blank')}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-sm">
                    暂无 cookies 文件。点击上方按钮录制。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Logs</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={clearLogs}>
            清空
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 rounded-md border p-2">
            <pre className="text-xs leading-5">{logs.join('\n') || 'No logs yet.'}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
