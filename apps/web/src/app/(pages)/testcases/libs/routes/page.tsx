'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Trash2, Upload } from 'lucide-react'

type RouteItem = {
  source: string
  path: string
  component?: string | null
}

type RoutesProject = {
  id: string
  name: string
  filePath: string
  updatedAt?: string
  routeCount: number
  readOnly?: boolean
}

type RoutesProjectsResponse = {
  projects: RoutesProject[]
}

type RoutesConfigResponse = {
  id: string
  name: string
  routes: RouteItem[]
  meta?: Record<string, any>
  filePath?: string
  lastModified?: string
  readOnly?: boolean
}

export default function RoutesConfigsPage() {
  const [projects, setProjects] = useState<RoutesProject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<RoutesConfigResponse | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | string>('all')
  const [newProjectId, setNewProjectId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadMode, setUploadMode] = useState<'create' | 'overwrite'>('create')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const currentProject = useMemo(
    () => (selectedId ? projects.find((p) => p.id === selectedId) || null : null),
    [projects, selectedId]
  )

  const fetchProjects = async (opts?: { keepSelection?: boolean }) => {
    setLoadingList(true)
    setError(null)
    try {
      const res = await fetch('/api/routes-configs', { cache: 'no-store' })
      if (!res.ok) {
        let msg = `加载项目列表失败 (${res.status})`
        try {
          const body = (await res.json()) as any
          if (body?.message) msg = body.message
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      const body = (await res.json()) as RoutesProjectsResponse
      const list = body.projects || []
      setProjects(list)

      const keep = opts?.keepSelection ?? true
      let nextId: string | null = null
      if (keep && selectedId && list.some((p) => p.id === selectedId)) {
        nextId = selectedId
      } else {
        nextId = list.length ? list[0].id : null
      }
      setSelectedId(nextId)
      if (nextId) {
        await fetchRoutes(nextId)
      } else {
        setData(null)
      }
    } catch (e: any) {
      setError(e?.message || '加载项目列表失败')
      setProjects([])
      setSelectedId(null)
      setData(null)
    } finally {
      setLoadingList(false)
    }
  }

  const fetchRoutes = async (id: string) => {
    if (!id) {
      setData(null)
      return
    }
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/routes-configs/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        let msg = `加载失败 (${res.status})`
        try {
          const body = (await res.json()) as any
          if (body?.message) msg = body.message
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      const body = (await res.json()) as RoutesConfigResponse
      setData(body)
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setData(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    void fetchProjects()
  }, [])

  const allRoutes = data?.routes ?? []

  const allSources = useMemo(() => {
    const set = new Set<string>()
    for (const r of allRoutes) {
      if (r.source) set.add(r.source)
    }
    return Array.from(set.values()).sort()
  }, [allRoutes])

  const filteredRoutes = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    const list = allRoutes.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
      if (!q) return true
      const haystack = `${r.path || ''} ${r.component || ''} ${r.source || ''}`.toLowerCase()
      return haystack.includes(q)
    })
    return list.sort((a, b) => {
      if (a.path === b.path) return (a.component || '').localeCompare(b.component || '')
      return a.path.localeCompare(b.path)
    })
  }, [allRoutes, searchText, sourceFilter])

  const handleUploadClick = (mode: 'create' | 'overwrite') => {
    setUploadMode(mode)
    try {
      fileInputRef.current?.click()
    } catch {
      // ignore
    }
  }

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    // 允许再次选择同一个文件
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)

      if (uploadMode === 'create') {
        if (newProjectId.trim()) {
          form.append('projectId', newProjectId.trim())
        }
      } else if (uploadMode === 'overwrite') {
        if (!selectedId) {
          throw new Error('当前未选择项目，无法覆盖')
        }
        form.append('projectId', selectedId)
        form.append('overwrite', '1')
      }

      const res = await fetch('/api/routes-configs', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        let msg = `上传失败 (${res.status})`
        try {
          const body = (await res.json()) as any
          if (body?.message) msg = body.message
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      await fetchProjects({ keepSelection: uploadMode === 'overwrite' })
    } catch (e: any) {
      setError(e?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteCurrent = async () => {
    if (!selectedId) return
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`确认删除路由配置 "${selectedId}" 吗？此操作不可恢复。`)
      if (!ok) return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/routes-configs/${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        let msg = `删除失败 (${res.status})`
        try {
          const body = (await res.json()) as any
          if (body?.message) msg = body.message
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      await fetchProjects({ keepSelection: false })
    } catch (e: any) {
      setError(e?.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
      <div>
        <h1 className="text-2xl font-semibold">路由配置管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理各项目的路由配置 JSON，目前接入的是旧版 Web 项目（web-fe）的
          web-fe-routes.json，后续可以扩展到更多前端项目。
        </p>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>路由列表</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {data?.lastModified && currentProject
                ? `当前项目：${currentProject.name}（${currentProject.id}） · 最后更新：${new Date(
                    data.lastModified
                  ).toLocaleString()} · 来源文件：${data.filePath || currentProject.filePath}`
                : projects.length === 0
                ? '尚未添加任何路由配置，请先上传 JSON。'
                : '请选择项目以查看路由列表。'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <Select
                  value={selectedId || ''}
                  onValueChange={(v) => {
                    const id = v || null
                    setSelectedId(id)
                    if (id) void fetchRoutes(id)
                    else setData(null)
                  }}
                >
                  <SelectTrigger id="routes-project">
                    <SelectValue placeholder="选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        暂无项目
                      </SelectItem>
                    ) : (
                      projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.id})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => fetchProjects({ keepSelection: true })}
                disabled={loadingList}
              >
                <RefreshCw className="h-4 w-4" />
                {loadingList ? '刷新中…' : '刷新项目'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 text-red-600"
                onClick={handleDeleteCurrent}
                disabled={!selectedId || deleting}
              >
                <Trash2 className="h-4 w-4" />
                删除当前
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <Input
                  placeholder="新项目 ID（可选）"
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => handleUploadClick('create')}
                disabled={uploading}
              >
                <Upload className="h-4 w-4" />
                {uploading && uploadMode === 'create' ? '上传中…' : '新增项目'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => handleUploadClick('overwrite')}
                disabled={!selectedId || uploading}
              >
                <Upload className="h-4 w-4" />
                {uploading && uploadMode === 'overwrite' ? '覆盖中…' : '覆盖当前项目'}
              </Button>
              <div className="w-40">
                <Select
                  value={sourceFilter}
                  onValueChange={(v) => setSourceFilter(v as 'all' | string)}
                >
                  <SelectTrigger id="routes-source">
                    <SelectValue placeholder="来源过滤" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部来源</SelectItem>
                    {allSources.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Input
                  placeholder="按路径 / 组件名搜索"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead className="w-40">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      {loadingDetail
                        ? '正在加载路由列表…'
                        : '暂无路由数据，请先选择项目或上传 JSON。'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoutes.map((r, idx) => (
                    <TableRow key={`${r.source}::${r.path}::${r.component || ''}`}>
                      <TableCell className="text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.path}</TableCell>
                      <TableCell className="text-xs">
                        {r.component || <span className="text-muted-foreground">（无）</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            提示：此列表仅用于“页面索引”和分析用途，后续可以为不同项目维护多份路由 JSON，并在此页面统一查看与管理。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
