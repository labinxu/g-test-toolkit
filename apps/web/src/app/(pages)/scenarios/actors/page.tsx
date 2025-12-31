'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ResizableStickyTable, { type ColumnDef } from '@/components/data-table'
import { OptionsSelectSearch } from '@/components/select/options-select-search'
import type { OptionsSelectItem } from '@/components/select/options-select'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, Plus, RefreshCcw, Save, Trash2 } from 'lucide-react'

type ActorEnvRow = { id: number; name: string }
type ActorRow = {
  id: number
  accountName: string
  password: string
  envId: number
  env?: { id: number; name: string } | null
}

export default function ScenarioActorsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [envs, setEnvs] = useState<ActorEnvRow[]>([])
  const [actors, setActors] = useState<ActorRow[]>([])

  const [filter, setFilter] = useState('')

  const [newAccountName, setNewAccountName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newEnvId, setNewEnvId] = useState<string>('')

  const envItems = useMemo<OptionsSelectItem<string>[]>(() => {
    return (envs || []).map((e) => ({ value: String(e.id), label: e.name }))
  }, [envs])

  const filteredActors = useMemo(() => {
    const q = (filter || '').trim().toLowerCase()
    if (!q) return actors
    return (actors || []).filter((a) => {
      const envName = a.env?.name || ''
      return [a.accountName, envName].some((s) => (s || '').toLowerCase().includes(q))
    })
  }, [actors, filter])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [envRes, actorRes] = await Promise.all([
        fetch('/api/actors/environments', { cache: 'no-store' }),
        fetch('/api/actors', { cache: 'no-store' }),
      ])

      if (!envRes.ok) {
        const err = await normalizeResponseError(envRes)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Failed to load environments')
      }
      if (!actorRes.ok) {
        const err = await normalizeResponseError(actorRes)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || 'Failed to load actors')
      }

      const envData = (await envRes.json()) as ActorEnvRow[]
      const actorData = (await actorRes.json()) as ActorRow[]
      setEnvs(envData || [])
      setActors(
        (actorData || []).map((a) => ({
          ...a,
          envId: a.envId || a.env?.id || 0,
        })),
      )

      if (!newEnvId && (envData || []).length) {
        setNewEnvId(String(envData[0].id))
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        setError(e?.message || 'Failed to load')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createActor() {
    try {
      const envIdNum = Number(newEnvId)
      if (!newAccountName.trim()) {
        toast.error('请输入账户名')
        return
      }
      if (!Number.isFinite(envIdNum) || envIdNum <= 0) {
        toast.error('请选择环境')
        return
      }
      const res = await fetch('/api/actors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountName: newAccountName.trim(),
          password: newPassword,
          envId: envIdNum,
        }),
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
      toast.success('Actor 已创建')
      setNewAccountName('')
      setNewPassword('')
      await load()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) toast.error(e?.message || 'Create failed')
    }
  }

  async function saveActor(row: ActorRow) {
    setSavingId(row.id)
    try {
      const envIdNum = Number(row.envId)
      if (!row.accountName.trim()) throw new Error('账户名不能为空')
      if (!Number.isFinite(envIdNum) || envIdNum <= 0) throw new Error('请选择环境')
      const res = await fetch(`/api/actors/${row.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountName: row.accountName.trim(),
          password: row.password,
          envId: envIdNum,
        }),
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
      toast.success('已保存')
      await load()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) toast.error(e?.message || 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteActor(id: number) {
    const confirmed = window.confirm('确认删除该 Actor？')
    if (!confirmed) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/actors/${id}`, { method: 'DELETE' })
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
      toast.success('已删除')
      await load()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) toast.error(e?.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const columns = useMemo<ColumnDef<ActorRow>[]>(() => {
    return [
      { key: 'id', header: 'ID', width: 80, accessor: (r) => r.id },
      {
        key: 'accountName',
        header: '账户名',
        width: 260,
        accessor: (r) => r.accountName,
        render: (r) => (
          <Input
            className="h-8"
            value={r.accountName || ''}
            onChange={(e) =>
              setActors((prev) => prev.map((x) => (x.id === r.id ? { ...x, accountName: e.target.value } : x)))
            }
          />
        ),
      },
      {
        key: 'password',
        header: '密码',
        width: 260,
        accessor: (r) => r.password,
        render: (r) => (
          <Input
            className="h-8"
            type="password"
            value={r.password || ''}
            onChange={(e) =>
              setActors((prev) => prev.map((x) => (x.id === r.id ? { ...x, password: e.target.value } : x)))
            }
            placeholder="(empty)"
          />
        ),
      },
      {
        key: 'env',
        header: '环境',
        width: 200,
        accessor: (r) => r.env?.name || '',
        render: (r) => (
          <OptionsSelectSearch
            size="sm"
            value={r.envId ? String(r.envId) : ''}
            onChange={(val) => {
              const envId = Number(val)
              const env = envs.find((e) => e.id === envId) || null
              setActors((prev) =>
                prev.map((x) =>
                  x.id === r.id
                    ? { ...x, envId, env: env ? { id: env.id, name: env.name } : null }
                    : x,
                ),
              )
            }}
            items={envItems}
            placeholder="选择环境"
            className="min-w-[160px]"
          />
        ),
      },
      {
        key: 'actions',
        header: '',
        width: 220,
        render: (r) => (
          <div className="flex items-center justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={savingId === r.id || deletingId === r.id}
                  onClick={() => saveActor(r)}
                  aria-label="保存"
                >
                  {savingId === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>保存</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  disabled={savingId === r.id || deletingId === r.id}
                  onClick={() => deleteActor(r.id)}
                  aria-label="删除"
                >
                  {deletingId === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>删除</TooltipContent>
            </Tooltip>
          </div>
        ),
      },
    ]
  }, [deletingId, envItems, envs, savingId])

  return (
    <div className="flex w-full flex-1 flex-col p-2">
      <div className="mt-1 mb-2 flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {error ? <span className="text-red-500">{error}</span> : loading ? 'Loading...' : `${actors.length} actors`}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search account/env..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-72"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={load}
                disabled={loading}
                className="h-8 w-8 rounded-full"
                aria-label="刷新"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>刷新</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="mb-2 grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-12">
        <div className="space-y-1 md:col-span-4">
          <div className="text-xs text-muted-foreground">账户名</div>
          <Input
            className="h-9"
            placeholder="例如：user1@example.com"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-4">
          <div className="text-xs text-muted-foreground">密码</div>
          <Input
            className="h-9"
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-3">
          <div className="text-xs text-muted-foreground">环境</div>
          <OptionsSelectSearch
            value={newEnvId}
            onChange={setNewEnvId}
            items={envItems}
            placeholder="选择环境"
            disabled={!envItems.length}
          />
        </div>
        <div className="flex items-end justify-end md:col-span-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={createActor}
                disabled={loading || !envItems.length}
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label="添加 Actor"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>添加 Actor</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ResizableStickyTable
        rows={filteredActors}
        columns={columns}
        getRowKey={(row) => String(row.id)}
        page={1}
        pageSize={Math.max(20, filteredActors.length || 20)}
        stickyHeader
        headerHeightPx={40}
        framePadding="none"
        frameClassName="rounded-none"
        headerLightClass="bg-transparent text-foreground"
        headerDarkClass="dark:bg-transparent dark:text-foreground"
        enableFilters={false}
        onRowDoubleClick={(row) => saveActor(row)}
        caption={
          <div className="text-xs text-muted-foreground">
            用于 Scenarios 步骤/检查点选择的账号库（环境使用 OptionsSelectSearch）。
          </div>
        }
      />
    </div>
  )
}
