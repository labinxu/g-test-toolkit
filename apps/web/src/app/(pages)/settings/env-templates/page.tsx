'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { OptionsSelect } from '@/components/select/options-select'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type EnvTemplate = {
  id: number
  platform: string
  driver: 'browser' | 'android' | 'ios' | 'other'
  key: string
  name: string
  description?: string | null
  config: any
  enabled: boolean
  sortOrder: number
}

const PLATFORM_OPTIONS = [
  { value: 'gettr-web', label: 'GETTR Web' },
  { value: 'gettr-android', label: 'GETTR Android' },
  { value: 'gettr-mobile-web', label: 'GETTR Mobile Web' },
  { value: 'gettr-ios', label: 'GETTR iOS' },
  { value: 'gettr-api-livestream', label: 'GETTR API (Livestream)' },
]

const DRIVER_OPTIONS = [
  { value: 'browser', label: 'Browser' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'other', label: 'Other' },
]

function normalizeJsonLike(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  // 如果本身就是合法 JSON，直接格式化返回
  try {
    const obj = JSON.parse(text)
    return JSON.stringify(obj, null, 2)
  } catch {
    // ignore and try to normalize
  }
  let raw = text
  // 移除对象/数组结尾多余的逗号
  raw = raw.replace(/,\s*([}\]])/g, '$1')
  // 将单引号替换为双引号
  raw = raw.replace(/'/g, '"')
  // 为未加引号的 key 添加双引号：deviceName: -> "deviceName":
  raw = raw.replace(/([{\s,])([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
  try {
    const obj = JSON.parse(raw)
    return JSON.stringify(obj, null, 2)
  } catch {
    return null
  }
}

export default function EnvTemplatesPage() {
  const router = useRouter()
  const [platform, setPlatform] = useState<string>('gettr-web')
  const [driver, setDriver] = useState<'browser' | 'android' | 'ios' | 'other'>('browser')
  const [items, setItems] = useState<EnvTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<EnvTemplate | null>(null)
  const [editingConfigText, setEditingConfigText] = useState('')

  const apiPrefix = '/api/env-templates'

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams()
      if (platform) qs.set('platform', platform)
      if (driver) qs.set('driver', driver)
      const res = await fetch(`${apiPrefix}?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || 'Failed to load environment templates')
      }
      const data = await res.json()
      const list = Array.isArray(data?.items) ? (data.items as EnvTemplate[]) : []
      const parsed = list.map((it) => {
        let cfg: any = {}
        try {
          cfg = it.config && typeof it.config === 'string' ? JSON.parse(it.config) : it.config || {}
        } catch {
          cfg = {}
        }
        return { ...it, config: cfg }
      })
      setItems(parsed)
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '加载环境模板失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, driver])

  const startCreate = () => {
    const next: EnvTemplate = {
      id: 0,
      platform,
      driver,
      key: '',
      name: '',
      description: '',
      config: {},
      enabled: true,
      sortOrder: 0,
    }
    setEditing(next)
    setEditingConfigText('')
  }

  const saveEditing = async () => {
    if (!editing) return
    let parsedConfig: any = {}
    try {
      parsedConfig = editingConfigText.trim() ? JSON.parse(editingConfigText) : {}
    } catch {
      toast.error('配置 JSON 不是有效的 JSON，请检查后再保存')
      return
    }
    const body = {
      platform: editing.platform,
      driver: editing.driver,
      key: editing.key,
      name: editing.name,
      description: editing.description ?? '',
      config: parsedConfig,
      enabled: editing.enabled,
      sortOrder: editing.sortOrder ?? 0,
    }
    try {
      const isNew = !editing.id
      const url = isNew ? apiPrefix : `${apiPrefix}/${editing.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '保存环境模板失败')
      }
      toast.success('已保存环境模板')
      setEditing(null)
      await loadTemplates()
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '保存环境模板失败')
    }
  }

  const handleDelete = async (id: number) => {
    const ok = window.confirm('确认删除该环境模板？')
    if (!ok) return
    try {
      const res = await fetch(`${apiPrefix}/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '删除环境模板失败')
      }
      toast.success('已删除环境模板')
      if (editing && editing.id === id) {
        setEditing(null)
      }
      await loadTemplates()
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
        return
      }
      toast.error(e?.message || '删除环境模板失败')
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">环境模板管理</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              针对不同平台与驱动类型（browser / android / other），预先定义 useTestCase
              的环境配置，供用户场景与用例库生成/运行代码时复用。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void loadTemplates()}>
              刷新
            </Button>
            <Button type="button" size="sm" onClick={startCreate}>
              新增模板
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-[11px]">平台</Label>
              <OptionsSelect<string>
                value={platform}
                items={PLATFORM_OPTIONS}
                onSelect={(item) => setPlatform(item.value)}
                placeholder="选择平台"
                size="sm"
                triggerClassName="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">驱动类型</Label>
              <OptionsSelect<'browser' | 'android' | 'ios' | 'other'>
                value={driver}
                items={DRIVER_OPTIONS as any}
                onSelect={(item) => setDriver(item.value as any)}
                placeholder="选择驱动"
                size="sm"
                triggerClassName="text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">
                模板列表（{loading ? '加载中…' : `${items.length} 个`}）
              </div>
            </div>
            <div className="space-y-1 rounded border">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => {
                      setEditing(it)
                      try {
                        setEditingConfigText(JSON.stringify(it.config ?? {}, null, 2))
                      } catch {
                        setEditingConfigText('')
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{it.name}</span>
                      <span className="text-[11px] text-muted-foreground">({it.key})</span>
                      {!it.enabled && (
                        <span className="text-[11px] text-muted-foreground">(已禁用)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {it.description ||
                        (it.driver === 'android'
                          ? 'Android 环境配置模板'
                          : 'Browser 环境配置模板')}
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-xs text-destructive"
                    onClick={() => void handleDelete(it.id)}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {!items.length && !loading && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  暂无模板，请点击右上角「新增模板」按钮创建。
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editing.id ? '编辑环境模板' : '新增环境模板'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[11px]">平台</Label>
                <OptionsSelect<string>
                  value={editing.platform}
                  items={PLATFORM_OPTIONS}
                  onSelect={(item) =>
                    setEditing((prev) => (prev ? { ...prev, platform: item.value } : prev))
                  }
                  placeholder="选择平台"
                  size="sm"
                  triggerClassName="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">驱动类型</Label>
                <OptionsSelect<'browser' | 'android' | 'ios' | 'other'>
                  value={editing.driver}
                  items={DRIVER_OPTIONS as any}
                  onSelect={(item) =>
                    setEditing((prev) =>
                      prev ? { ...prev, driver: item.value as any } : prev
                    )
                  }
                  placeholder="选择驱动"
                  size="sm"
                  triggerClassName="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">排序（升序）</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, sortOrder: Number(e.target.value || 0) } : prev
                    )
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Key</Label>
                <Input
                  className="h-8 text-xs"
                  value={editing.key}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, key: e.target.value.replace(/[^a-zA-Z0-9_-]+/g, '') } : prev
                    )
                  }
                  placeholder="例如：stg-web"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">名称</Label>
                <Input
                  className="h-8 text-xs"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                  placeholder="例如：STG Web 浏览器"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">启用</Label>
                <OptionsSelect<'true' | 'false'>
                  value={editing.enabled ? 'true' : 'false'}
                  items={[
                    { value: 'true', label: '是' },
                    { value: 'false', label: '否' },
                  ]}
                  onSelect={(item) =>
                    setEditing((prev) =>
                      prev ? { ...prev, enabled: item.value === 'true' } : prev
                    )
                  }
                  size="sm"
                  triggerClassName="text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">描述（可选）</Label>
              <Textarea
                rows={2}
                className="text-xs"
                value={editing.description || ''}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, description: e.target.value || '' } : prev
                  )
                }
                placeholder="用于说明该模板在什么场景下使用。"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">
                配置 JSON（{editing.driver === 'android' ? 'android' : 'browser'} 字段）
              </Label>
              <Textarea
                rows={10}
                className="font-mono text-xs"
                value={editingConfigText}
                onChange={(e) => setEditingConfigText(e.target.value)}
                onBlur={() => {
                  const normalized = normalizeJsonLike(editingConfigText)
                  if (normalized != null) {
                    setEditingConfigText(normalized)
                  }
                }}
                placeholder={
                  editing.driver === 'android'
                    ? `例如：\n{\n  "deviceName": "pixel6",\n  "udid": "emulator-5554",\n  "appPackage": "com.gettr.gettr"\n}`
                    : `例如：\n{\n  "headless": false,\n  "debug": true,\n  "domain": "https://stg.gettr.com"\n}`
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(null)}
              >
                取消
              </Button>
              <Button type="button" size="sm" onClick={() => void saveEditing()}>
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
