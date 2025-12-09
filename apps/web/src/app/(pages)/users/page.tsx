 "use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import ResizableStickyTable, { type ColumnDef } from '@/components/data-table'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'

type UserRow = { id: number; username: string; email: string; isAdmin: boolean }

export default function UsersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState<'id'|'username'|'email'|'isAdmin'>('id')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [total, setTotal] = useState(0)
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [resetPassword, setResetPassword] = useState('')

  const filtered = useMemo(() => {
    const f = (filter || '').trim().toLowerCase()
    if (!f) return users
    return users.filter((u) => [u.username, u.email].some((s) => (s || '').toLowerCase().includes(f)))
  }, [users, filter])

  const adminCount = useMemo(() => users.filter((u) => u.isAdmin).length, [users])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (filter.trim()) qs.set('q', filter.trim())
      qs.set('page', String(page))
      qs.set('pageSize', String(pageSize))
      qs.set('sortBy', sortBy)
      qs.set('sortDir', sortDir)
      const res = await fetch(`/api/settings/admins?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        const msg = res.status === 403 ? 'Forbidden (admin required)' : err.message
        throw new Error(msg || 'Failed to load users')
      }
      const data = (await res.json()) as { items: UserRow[]; total: number; page: number; pageSize: number }
      setUsers((data?.items || []).map((u) => ({ ...u, isAdmin: !!u.isAdmin })))
      setTotal(data?.total || 0)
      setPage(data?.page || page)
      setPageSize(data?.pageSize || pageSize)
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        setError(e?.message || 'Failed to load users')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, pageSize, sortBy, sortDir])
  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load() }, 300)
    return () => clearTimeout(t)
  }, [filter])

  async function save() {
    setSaving(true)
    try {
      const updates = users.map((u) => ({ id: u.id, isAdmin: !!u.isAdmin }))
      const res = await fetch('/api/settings/admins', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Save failed')
      }
      toast.success('Saved')
      await load()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  async function createUser() {
    try {
      const payload = {
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        isAdmin: newIsAdmin,
      }
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Create failed')
      }
      toast.success('User created')
      setNewUsername('')
      setNewEmail('')
      setNewPassword('')
      setNewIsAdmin(false)
      await load()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || 'Create failed')
      }
    }
  }

  async function deleteUser(uid: number) {
    try {
      const res = await fetch(`/api/settings/users/${uid}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Delete failed')
      }
      toast.success('Deleted')
      await load()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || 'Delete failed')
      }
    }
  }

  async function applyResetPassword() {
    if (!resetUserId) return
    try {
      const res = await fetch(`/api/settings/users/${resetUserId}/password`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Update failed')
      }
      toast.success('Password updated')
      setResetUserId(null)
      setResetPassword('')
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || 'Update failed')
      }
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col p-2">
      <div className="mt-1 mb-2 flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{error ? <span className="text-red-500">{error}</span> : loading ? 'Loading...' : `${users.length} users`}</div>
        <div className="flex items-center gap-2">
          <Input placeholder="Filter by username/email" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-64" />
          <select title="Page size" className="h-8 rounded border px-2 text-sm" value={pageSize} onChange={(e) => { setPageSize(Math.max(1, Math.min(200, parseInt(e.target.value || '20', 10)))) }}>
            {[10,20,50,100].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <select title="Sort by" className="h-8 rounded border px-2 text-sm" value={sortBy} onChange={(e) => { const v = (e.target.value as any); setSortBy(v); setPage(1) }}>
            <option value="id">ID</option>
            <option value="username">Username</option>
            <option value="email">Email</option>
            <option value="isAdmin">Admin</option>
          </select>
          <select title="Order" className="h-8 rounded border px-2 text-sm" value={sortDir} onChange={(e) => { const v = (e.target.value as any); setSortDir(v); setPage(1) }}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <Button variant="outline" onClick={load} disabled={loading} className="h-8">Refresh</Button>
          <Button onClick={save} disabled={saving || !!error || loading} className="h-8">{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded border p-2">
        <div className="text-sm font-medium mr-2">Create User</div>
        <Input placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="h-8 w-40" />
        <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-8 w-56" />
        <Input placeholder="Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-8 w-40" />
        <div className="flex items-center gap-2">
          <Switch id="new-isadmin" checked={newIsAdmin} onCheckedChange={(v) => setNewIsAdmin(!!v)} />
          <label htmlFor="new-isadmin" className="text-xs">Admin</label>
        </div>
        <Button onClick={createUser} className="h-8">Create</Button>
      </div>

      <ResizableStickyTable<UserRow>
        rows={filtered}
        columns={useMemo<ColumnDef<UserRow>[]>(() => [
          { key: 'id', header: 'ID', width: 60, minWidth: 60, sortable: false, accessor: (u) => u.id },
          { key: 'username', header: 'Username', width: 240, minWidth: 160, sortable: false, render: (u) => (
            <div className="truncate max-w-[220px]">
              <InlineEditText
                value={u.username}
                onChange={(val) => setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, username: val } : x)))}
                onApply={async (val) => {
                  if (!val.trim()) return toast.error('Username required')
                  try {
                    const res = await fetch(`/api/settings/users/${u.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: val.trim() }) })
                    if (!res.ok) {
                      const err = await normalizeResponseError(res)
                      throw new Error(err.message || 'Update failed')
                    }
                    toast.success('Updated')
                  } catch (e: any) { toast.error(e?.message || 'Update failed'); await load() }
                }}
              />
            </div>
          ) },
          { key: 'email', header: 'Email', width: 320, minWidth: 200, sortable: false, render: (u) => (
            <div className="truncate max-w-[320px]">
              <InlineEditText
                value={u.email}
                onChange={(val) => setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, email: val } : x)))}
                onApply={async (val) => {
                  const email = val.trim()
                  if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Invalid email')
                  try {
                    const res = await fetch(`/api/settings/users/${u.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
                    if (!res.ok) {
                      const err = await normalizeResponseError(res)
                      throw new Error(err.message || 'Update failed')
                    }
                    toast.success('Updated')
                  } catch (e: any) { toast.error(e?.message || 'Update failed'); await load() }
                }}
              />
            </div>
          ) },
          { key: 'isAdmin', header: 'Admin', width: 120, minWidth: 100, sortable: false, render: (u) => (
            <div className="flex items-center gap-2">
              <Switch id={`adm-${u.id}`} checked={!!u.isAdmin} disabled={u.isAdmin && adminCount <= 1} onCheckedChange={(v) => {
                if (u.isAdmin && adminCount <= 1 && !v) { toast.error('Cannot remove the last admin'); return }
                setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, isAdmin: !!v } : x)))
              }} />
              <label htmlFor={`adm-${u.id}`} className="text-xs">{u.isAdmin ? 'Yes' : 'No'}</label>
            </div>
          ) },
          { key: 'actions', header: 'Actions', width: 220, minWidth: 180, sortable: false, render: (u) => (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Button variant="outline" size="sm" onClick={() => { setResetUserId(u.id); setResetPassword('') }}>Reset PW</Button>
              <Button variant="destructive" size="sm" className="px-3" onClick={() => {
                if (u.isAdmin && adminCount <= 1) { toast.error('Cannot delete the last admin'); return }
                if (window.confirm(`Delete user ${u.username || u.email}?`)) deleteUser(u.id)
              }}>Delete</Button>
            </div>
          ) },
        ], [users, adminCount])}
        getRowKey={(u) => String(u.id)}
        page={1}
        pageSize={filtered.length || 1}
        caption={<span>Toggle Admin and click Save.</span>}
      />

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {total > 0 ? `Showing ${(page-1)*pageSize+1}-${Math.min(page*pageSize, total)} of ${total}` : 'No results'}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page<=1} onClick={() => setPage((p) => Math.max(1, p-1))}>Prev</Button>
          <span>Page {page}</span>
          <Button variant="outline" size="sm" disabled={page*pageSize>=total} onClick={() => setPage((p) => p+1)}>Next</Button>
        </div>
      </div>

      {resetUserId != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded border p-2">
          <div className="text-sm font-medium mr-2">Reset Password (User #{resetUserId})</div>
          <Input placeholder="New password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="h-8 w-64" />
          <Button onClick={applyResetPassword} className="h-8">Apply</Button>
          <Button variant="outline" onClick={() => { setResetUserId(null); setResetPassword('') }} className="h-8">Cancel</Button>
        </div>
      )}
    </div>
  )
}

function InlineEditText({ value, onChange, onApply }: { value: string; onChange: (v: string) => void; onApply: (v: string) => void | Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="truncate">{value}</span>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setEditing(true)}>Edit</Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <Input className="h-8 w-56" value={val} onChange={(e) => setVal(e.target.value)} />
      <Button size="sm" className="h-8" onClick={async () => { await onApply(val); onChange(val); setEditing(false) }}>Apply</Button>
      <Button size="sm" variant="outline" className="h-8" onClick={() => { setVal(value); setEditing(false) }}>Cancel</Button>
    </div>
  )
}
