'use client'

import { useMemo, useState } from 'react'
import { ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionsSelect } from '@/components/select/options-select'
import { OptionsSelectInput } from '@/components/select/options-select-input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScenarioStepsTable } from '../shared/steps-table'
import type {
  AdminAction,
  AdminCallStep,
  AdminElement,
  AdminPage,
  AdminParam,
  PageSummary,
} from '../../action-catalog/types'

type Props = {
  action: AdminAction
  index: number
  draft: AdminPage
  pages: PageSummary[]
  allActions: AdminAction[]
  onUpdateAction: (index: number, patch: Partial<AdminAction>) => void
  onDeleteAction: (index: number) => void
  onAddParam: (index: number) => void
  onUpdateParam: (actionIndex: number, paramIndex: number, patch: Partial<AdminParam>) => void
  onDeleteParam: (actionIndex: number, paramIndex: number) => void
  callSourcePageId: number | null
  setCallSourcePageId: (id: number | null) => void
  callSourceActionsByPageId: Record<number, AdminAction[]>
  loadCallSourceActions: (pageId: number) => Promise<AdminAction[]>
  loadingCallSource: boolean
  collapsible?: boolean
  /**
   * 可选：当内部调用选择了列表中不存在的 key 时，用此回调自行处理（例如标记为基类方法调用）。
   */
  onCallStepSelectMissing?: (key: string) => void
}

export function ActionForm({
  action: a,
  index,
  draft,
  pages,
  allActions,
  onUpdateAction,
  onDeleteAction,
  onAddParam,
  onUpdateParam,
  onDeleteParam,
  callSourcePageId,
  setCallSourcePageId,
  callSourceActionsByPageId,
  loadCallSourceActions,
  loadingCallSource,
  collapsible = true,
  onCallStepSelectMissing,
}: Props) {
  const [copiedActionValue, setCopiedActionValue] = useState<string>('')
  const [callStepDialogOpen, setCallStepDialogOpen] = useState(false)
  const [editingCallStepIndex, setEditingCallStepIndex] = useState<number | null>(null)
  const [editingCallStepTarget, setEditingCallStepTarget] = useState('')
  const [editingCallStepArgs, setEditingCallStepArgs] = useState('')
  const [editingCallSourcePageId, setEditingCallSourcePageId] = useState<number | null>(null)
  const [editingCallStepOrder, setEditingCallStepOrder] = useState<number>(0)

  const copySourceActions = useMemo(() => {
    const sourcePageId =
      callSourcePageId != null ? callSourcePageId : draft?.id != null ? draft.id : null
    const sourceActions =
      sourcePageId != null && draft?.id != null
        ? sourcePageId === draft.id
          ? allActions
          : callSourceActionsByPageId[sourcePageId] || []
        : allActions
    return sourceActions
  }, [allActions, callSourceActionsByPageId, callSourcePageId, draft?.id])

  const copyOptions = useMemo(
    () =>
      copySourceActions.map((other, otherIndex) => ({
        value: String(otherIndex),
        label: (other.method || other.key || 'action') + (other.label ? ` · ${other.label}` : ''),
      })),
    [copySourceActions]
  )

  const copySelectValue = copyOptions.some((opt) => opt.value === copiedActionValue)
    ? copiedActionValue
    : ''

  const callStepsSorted =
    a.kind === 'call'
      ? (a.callSteps || [])
          .slice()
          .sort((x, y) => (x.sortOrder ?? 0) - (y.sortOrder ?? 0))
      : []

  const openCallStepDialog = (rowId: string) => {
    const idx = callStepsSorted.findIndex((_, i) => `${a.id ?? 'call'}-${i}` === rowId)
    if (idx < 0) return
    const step = callStepsSorted[idx]
    setEditingCallStepIndex(idx)
    setEditingCallStepTarget(step.targetActionKey || '')
    setEditingCallStepArgs((step.args || []).join(', '))
    setEditingCallStepOrder(step.sortOrder ?? idx)
    // 尝试找到该动作所在的页面
    const locatePageId = (() => {
      const foundInCurrent = allActions.find((act) => act.key === step.targetActionKey)
      if (foundInCurrent) return draft?.id ?? null
      const entries = Object.entries(callSourceActionsByPageId)
      for (const [pid, acts] of entries) {
        if ((acts || []).some((act) => act.key === step.targetActionKey)) {
          return Number(pid)
        }
      }
      return callSourcePageId != null ? callSourcePageId : draft?.id ?? null
    })()
    setEditingCallSourcePageId(locatePageId)
    if (locatePageId && locatePageId !== draft?.id) {
      void loadCallSourceActions(locatePageId)
    }
    setCallStepDialogOpen(true)
  }

  const saveCallStep = () => {
    if (editingCallStepIndex == null) {
      setCallStepDialogOpen(false)
      return
    }
    const next = [...callStepsSorted]
    const targetOrder = Number.isFinite(editingCallStepOrder) ? editingCallStepOrder : editingCallStepIndex
    const argsArr = editingCallStepArgs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    next[editingCallStepIndex] = {
      ...next[editingCallStepIndex],
      targetActionKey: editingCallStepTarget.trim(),
      args: argsArr,
      sortOrder: Number(targetOrder) || 0,
    }
    const reordered = next.slice().sort((aStep, bStep) => (aStep.sortOrder ?? 0) - (bStep.sortOrder ?? 0))
    const normalized = reordered.map((s, i) => ({ ...s, sortOrder: i }))
    onUpdateAction(index, { callSteps: normalized })
    setCallStepDialogOpen(false)
    setEditingCallStepIndex(null)
    setEditingCallStepTarget('')
    setEditingCallStepArgs('')
  }

  const editingPageActions =
    editingCallSourcePageId && editingCallSourcePageId !== draft?.id
      ? callSourceActionsByPageId[editingCallSourcePageId] || []
      : allActions

  const targetActionInfo =
    editingPageActions.find((act) => act.key === editingCallStepTarget) ||
    allActions.find((act) => act.key === editingCallStepTarget) ||
    null

  const actionTypeLabel = (() => {
    if (!targetActionInfo) return '—'
    if (targetActionInfo.kind === 'assert') return '断言'
    if (targetActionInfo.kind === 'call') return '函数调用'
    if (targetActionInfo.kind === 'action') {
      if (targetActionInfo.actionType === 'input') return '输入'
      if (targetActionInfo.actionType === 'drag') return '拖动'
      return '点击'
    }
    return targetActionInfo.kind || '—'
  })()

  const content = (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px]">key</Label>
          <Input
            className="h-8"
            value={a.key}
            onChange={(e) => onUpdateAction(index, { key: e.target.value })}
            placeholder="例如：hostOpenStudioFromHome"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">名称（label）</Label>
          <Input
            className="h-8"
            value={a.label}
            onChange={(e) =>
              onUpdateAction(index, {
                label: e.target.value,
              })
            }
            placeholder="例如：主播：从首页进入 Studio"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">方法名（method）</Label>
          <Input
            className="h-8"
            value={a.method}
            onChange={(e) =>
              onUpdateAction(index, {
                method: e.target.value,
              })
            }
            placeholder="例如：hostOpenStudioFromHome"
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px]">类型（kind）</Label>
          <OptionsSelect<'action:click' | 'action:input' | 'action:drag' | 'assert' | 'call'>
            value={
              a.kind === 'action'
                ? (`action:${a.actionType || 'click'}` as const)
                : (a.kind as 'assert' | 'call')
            }
            size="sm"
            items={[
              { value: 'action:click', label: '点击' },
              { value: 'action:input', label: '输入' },
              { value: 'action:drag', label: '拖动' },
              { value: 'assert', label: '断言（assert）' },
              { value: 'call', label: '函数调用（call）' },
            ]}
            onSelect={(item) => {
              if (item.value.startsWith('action:')) {
                const actionType = item.value.split(':')[1] as 'click' | 'input' | 'drag'
                onUpdateAction(index, {
                  kind: 'action',
                  actionType,
                })
                return
              }
              onUpdateAction(index, {
                kind: item.value as 'assert' | 'call',
                actionType: undefined,
              })
            }}
            contentClassName="w-[200px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">排序（sortOrder）</Label>
          <Input
            className="h-8"
            type="number"
            value={a.sortOrder}
            onChange={(e) =>
              onUpdateAction(index, {
                sortOrder: Number(e.target.value || 0),
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">启用</Label>
          <OptionsSelect<'true' | 'false'>
            value={a.enabled ? 'true' : 'false'}
            size="sm"
            items={[
              { value: 'true', label: '是' },
              { value: 'false', label: '否' },
            ]}
            onSelect={(item) =>
              onUpdateAction(index, {
                enabled: item.value === 'true',
              })
            }
            contentClassName="w-[120px]"
          />
        </div>
      </div>

      {a.kind === 'call' && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            函数调用类型：通常对应在 Page 类中手写的组合方法（例如
            <span className="mx-0.5 font-mono text-[10px]">loginWithUsername</span>
            ），生成代码时会输出一行
            <span className="mx-0.5 font-mono text-[10px]">
              await {draft?.varName || 'page'}.{a.method || 'method'}(...)
            </span>
            。你可以直接填写方法名和参数，或从任意页面已有动作中复制方法签名。
          </p>
          <div className="mt-1 grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px]">来源页面（可选）</Label>
              <OptionsSelect<string>
                value={
                  callSourcePageId != null
                    ? String(callSourcePageId)
                    : draft?.id != null
                      ? String(draft.id)
                      : ''
                }
                items={[
                  ...(draft?.id
                    ? (() => {
                        const curSummary = pages.find((p) => p.id === draft.id) || null
                        return [
                          {
                            value: String(draft.id),
                            label: `${curSummary?.label || draft.label || draft.key || '当前页面'}（当前页面）`,
                          },
                        ]
                      })()
                    : []),
                  ...pages
                    .filter((p) => p.id !== draft?.id)
                    .map((p) => ({
                      value: String(p.id),
                      label: `${p.label || p.key || 'page'}（${p.key}）`,
                    })),
                ]}
                onSelect={(item) => {
                  setCallSourcePageId(Number.isFinite(Number(item.value)) ? Number(item.value) : null)
                  if (Number.isFinite(Number(item.value))) {
                    void loadCallSourceActions(Number(item.value))
                  }
                }}
                placeholder={loadingCallSource ? '来源页面加载中…' : '选择一个已有动作以复制方法和参数'}
                size="sm"
                triggerClassName="text-[11px]"
                contentClassName="w-[260px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">复制已有动作（可选）</Label>
              <OptionsSelectInput
                value={copySelectValue}
                onChange={(val) => setCopiedActionValue(val)}
                items={copyOptions}
                onSelect={(item) => {
                  const other = copySourceActions[Number(item.value)]
                  if (other) {
                    onUpdateAction(index, {
                      method: other.method,
                      params: (other.params || []).map((p) => ({
                        ...p,
                      })),
                    })
                  }
                }}
                placeholder="从已有动作复制方法名与参数"
                size="sm"
                triggerClassName="text-[11px]"
                contentClassName="w-[260px]"
                inputClassName="text-[11px]"
              />
            </div>
          </div>

          <div className="rounded-md border px-2 py-2">
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-[11px]">内部调用序列（可选）</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  const steps = callStepsSorted
                  const nextStep: AdminCallStep = {
                    targetActionKey:
                      steps[steps.length - 1]?.targetActionKey ||
                      (allActions.find((x, idx) => idx !== index && x.method)?.key || ''),
                    args: [],
                    sortOrder: steps.length,
                  }
                  onUpdateAction(index, {
                    callSteps: [...steps, nextStep],
                  })
                }}
              >
                <Plus className="mr-1 h-3 w-3" />
                新增内部步骤
              </Button>
            </div>
            <ScenarioStepsTable
              steps={callStepsSorted.map((s, sIndex) => ({
                id: `${a.id ?? 'call'}-${sIndex}`,
                order: sIndex + 1,
                action: s.targetActionKey || '未设置',
                data: s.args?.length ? `参数：${s.args.join(', ')}` : '—',
                expected: '内部调用',
              }))}
              mode="editable"
              onEditStep={(id) => openCallStepDialog(id)}
              onMoveStep={(id, dir) => {
                const idx = callStepsSorted.findIndex((_, i) => `${a.id ?? 'call'}-${i}` === id)
                if (idx < 0) return
                const target = dir === 'up' ? idx - 1 : idx + 1
                if (target < 0 || target >= callStepsSorted.length) return
                const reordered = [...callStepsSorted]
                const [item] = reordered.splice(idx, 1)
                reordered.splice(target, 0, item)
                const normalized = reordered.map((s, i) => ({ ...s, sortOrder: i }))
                onUpdateAction(index, { callSteps: normalized })
              }}
              onDeleteStep={(id) => {
                const idx = callStepsSorted.findIndex((_, i) => `${a.id ?? 'call'}-${i}` === id)
                if (idx < 0) return
                const next = callStepsSorted
                  .filter((_, i) => i !== idx)
                  .map((s, i) => ({ ...s, sortOrder: i }))
                onUpdateAction(index, { callSteps: next })
              }}
            />
            {!callStepsSorted.length && (
              <p className="text-[11px] text-muted-foreground">
                暂无内部步骤。可通过上方按钮，为该函数依次调用当前 Page 中的其它方法。
              </p>
            )}
          </div>

	          <Dialog open={callStepDialogOpen} onOpenChange={setCallStepDialogOpen}>
	            <DialogContent className="sm:max-w-md">
	              <DialogHeader>
	                <DialogTitle>编辑内部调用</DialogTitle>
	                <DialogDescription className="sr-only">
	                  配置当前函数的内部调用步骤与参数。
	                </DialogDescription>
	              </DialogHeader>
	              <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
	                <div className="space-y-1">
	                  <Label className="text-[11px]">来源页面</Label>
	                  <OptionsSelect<string>
                    value={editingCallSourcePageId != null ? String(editingCallSourcePageId) : ''}
                    items={[
                      ...(draft?.id
                        ? (() => {
                            const curSummary = pages.find((p) => p.id === draft.id) || null
                            return [
                              {
                                value: String(draft.id),
                                label: `${curSummary?.label || draft.label || draft.key || '当前页面'}（当前页面）`,
                              },
                            ]
                          })()
                        : []),
                      ...pages
                        .filter((p) => p.id !== draft?.id)
                        .map((p) => ({
                          value: String(p.id),
                          label: `${p.label || p.key || 'page'}（${p.key}）`,
                        })),
                    ]}
                    onSelect={(item) => {
                      const pid = Number(item.value)
                      setEditingCallSourcePageId(Number.isFinite(pid) ? pid : null)
                      if (Number.isFinite(pid) && pid !== draft?.id) {
                        void loadCallSourceActions(pid)
                      }
                    }}
                    placeholder="选择来源页面"
                    size="sm"
                    triggerClassName="text-[11px]"
                    contentClassName="w-[240px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">目标动作</Label>
                  <OptionsSelectInput
                    value={editingCallStepTarget}
                    onChange={(val) => setEditingCallStepTarget(val)}
                    items={(editingPageActions || []).map((act) => ({
                      value: act.key,
                      label: `${act.key} · ${act.method || act.label || act.actionType || ''}`.trim(),
                    }))}
                    placeholder="选择或输入动作 key（基类方法可直接输入）"
                    size="sm"
                    triggerClassName="text-[11px]"
                    contentClassName="w-[260px]"
                    inputClassName="text-[11px]"
                    onSelect={(item) => {
                      setEditingCallStepTarget(item.value)
                    }}
                    onBlur={() => {
                      if (!editingCallStepTarget && onCallStepSelectMissing) return
                      if (
                        editingCallStepTarget &&
                        !(editingPageActions || []).some((act) => act.key === editingCallStepTarget)
                      ) {
                        onCallStepSelectMissing?.(editingCallStepTarget)
                      }
                    }}
                  />
                  {!targetActionInfo && editingCallStepTarget ? (
                    <p className="text-[11px] text-muted-foreground">
                      未找到同名动作，将直接调用当前页面/基类的
                      <span className="font-mono"> {editingCallStepTarget}()</span>
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">名称</Label>
                    <Input
                      className="h-8 text-[11px]"
                      value={targetActionInfo?.label || editingCallStepTarget || ''}
                      placeholder="目标动作名称"
                      readOnly
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">方法名</Label>
                    <Input
                      className="h-8 text-[11px]"
                      value={targetActionInfo?.method || editingCallStepTarget || ''}
                      placeholder="目标方法名"
                      readOnly
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">类型</Label>
                  <OptionsSelect<'action:click' | 'action:input' | 'action:drag' | 'assert' | 'call'>
                    value={
                      targetActionInfo
                        ? targetActionInfo.kind === 'action'
                          ? (`action:${targetActionInfo.actionType || 'click'}` as const)
                          : (targetActionInfo.kind as 'assert' | 'call')
                        : undefined
                    }
                    items={[
                      { value: 'action:click', label: '点击' },
                      { value: 'action:input', label: '输入' },
                      { value: 'action:drag', label: '拖动' },
                      { value: 'assert', label: '断言（assert）' },
                      { value: 'call', label: '函数调用（call）' },
                    ]}
                    size="sm"
                    triggerClassName="text-[11px]"
                    contentClassName="w-[200px]"
                    disabled
                    onSelect={() => {}}
                  />
                </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">排序</Label>
                    <Input
                      className="h-8 text-[11px]"
                      type="number"
                      value={editingCallStepOrder}
                      onChange={(e) => setEditingCallStepOrder(Number(e.target.value || 0))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">参数（逗号分隔，可引用当前函数参数）</Label>
                  <Input
                    className="h-8 text-[11px]"
                    value={editingCallStepArgs}
                    onChange={(e) => setEditingCallStepArgs(e.target.value)}
                    placeholder="如：username,password"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCallStepDialogOpen(false)}>
                  取消
                </Button>
                <Button type="button" onClick={saveCallStep}>
                  保存
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[11px]">默认期望结果（defaultExpected）</Label>
        <Textarea
          rows={2}
          className="text-xs"
          value={a.defaultExpected || ''}
          onChange={(e) =>
            onUpdateAction(index, {
              defaultExpected: e.target.value || null,
            })
          }
          placeholder="例如：页面在 30 秒内显示“直播中”状态。"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">说明（description，可选）</Label>
        <Textarea
          rows={2}
          className="text-xs"
          value={a.description || ''}
          onChange={(e) =>
            onUpdateAction(index, {
              description: e.target.value || null,
            })
          }
          placeholder="用于补充该动作对应的业务含义或使用建议。"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">元素定位字符串（locator，可选）</Label>
          <OptionsSelectInput<string>
            id={`ac-action-${index}-locator`}
            value={a.locator || ''}
            onChange={(value) =>
              onUpdateAction(index, {
                locator: value || null,
              })
            }
            items={
              Array.isArray((draft as any)?.elements)
                ? ((draft as any).elements as AdminElement[]).map((el) => ({
                    value: el.defaultLocator || `[data-testid="${el.elementId}"]`,
                    label: el.description ? `${el.elementId} — ${el.description}` : el.elementId,
                  }))
                : []
            }
            placeholder='可选择已导入的 data-testid，或直接输入 CSS/XPath，例如：[data-testid="login_button"]'
            className="w-full"
            size="sm"
            inputClassName="text-[11px]"
            disabled={a.kind === 'call'}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">返回对象（returnTarget）</Label>
         <OptionsSelect<string>
            value={a.returnTarget || 'this'}
            items={[
              {
                value: 'this',
                label: 'this（返回当前页面实例）',
              },
              ...pages.map((p) => ({
                value: p.className,
                label: `${p.label || p.key}（${p.className}）`,
              })),
            ]}
            onSelect={(item) =>
              onUpdateAction(index, {
                returnTarget: item.value,
              })
            }
            size="sm"
            triggerClassName="text-[11px]"
            contentClassName="w-[220px]"
          />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px]">参数列表（可选）</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="px-2 text-[11px]"
            onClick={() => onAddParam(index)}
          >
            <Plus className="mr-1 h-3 w-3" />
            新增参数
          </Button>
        </div>
        <div className="space-y-2">
          {(a.params || []).map((p, pIndex) => (
            <div
              key={`${p.id ?? 'new'}-${pIndex}`}
              className="flex flex-wrap items-center gap-2 rounded border px-2 py-1.5"
            >
              <div className="flex min-w-[120px] flex-1 flex-col gap-1">
                <Label className="text-[11px]">name</Label>
                <Input
                  className="h-8 text-[11px]"
                  value={p.name}
                  onChange={(e) =>
                    onUpdateParam(index, pIndex, {
                      name: e.target.value,
                    })
                  }
                  placeholder="例如：timeoutMs"
                />
              </div>
              <div className="flex w-[120px] flex-col gap-1">
                <Label className="text-[11px]">类型</Label>
                <OptionsSelect<'string' | 'number' | 'boolean'>
                  value={(p.type as any) || 'string'}
                  items={[
                    { value: 'string', label: 'string' },
                    { value: 'number', label: 'number' },
                    { value: 'boolean', label: 'boolean' },
                  ]}
                  onSelect={(item) =>
                    onUpdateParam(index, pIndex, {
                      type: item.value,
                    })
                  }
                  size="sm"
                  triggerClassName="text-[11px]"
                  contentClassName="w-[120px]"
                />
              </div>
              <div className="flex w-[90px] flex-col gap-1">
                <Label className="text-[11px]">必填</Label>
                <OptionsSelect<'true' | 'false'>
                  value={p.required ? 'true' : 'false'}
                  items={[
                    { value: 'true', label: '是' },
                    { value: 'false', label: '否' },
                  ]}
                  onSelect={(item) =>
                    onUpdateParam(index, pIndex, {
                      required: item.value === 'true',
                    })
                  }
                  size="sm"
                  triggerClassName="text-[11px]"
                  contentClassName="w-[120px]"
                />
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                <Label className="text-[11px]">placeholder</Label>
                <Input
                  className="h-8 text-[11px]"
                  value={p.placeholder || ''}
                  onChange={(e) =>
                    onUpdateParam(index, pIndex, {
                      placeholder: e.target.value || null,
                    })
                  }
                  placeholder="输入框提示，例如：最大等待时间（毫秒）"
                />
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                <Label className="text-[11px]">默认值</Label>
                <Input
                  className="h-8 text-[11px]"
                  value={p.defaultValue || ''}
                  onChange={(e) =>
                    onUpdateParam(index, pIndex, {
                      defaultValue: e.target.value || null,
                    })
                  }
                  placeholder="可选，例如：30000"
                />
              </div>
              <div className="flex w-[80px] flex-col gap-1">
                <Label className="text-[11px]">排序</Label>
                <Input
                  className="h-8 text-[11px]"
                  type="number"
                  value={p.sortOrder}
                  onChange={(e) =>
                    onUpdateParam(index, pIndex, {
                      sortOrder: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onDeleteParam(index, pIndex)}
                aria-label="删除参数"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!a.params?.length && (
            <p className="text-muted-foreground text-[11px]">
              暂无参数，如需在「添加步骤」时弹出参数输入框，可在此处新增参数定义。
            </p>
          )}
        </div>
      </div>
    </div>
  )

  if (!collapsible) {
    return (
      <div className="rounded-md border text-xs">
        <div className="px-3 py-3">{content}</div>
      </div>
    )
  }

  return (
    <Collapsible
      key={`${a.id ?? 'new'}-${index}`}
      defaultOpen
      className="rounded-md border text-xs"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center justify-between text-left"
            data-ac-action-collapsible-trigger
          >
            <div className="font-medium">
              动作 {index + 1} {a.key ? <span className="text-muted-foreground">({a.key})</span> : null}
            </div>
            <ChevronsUpDown className="text-muted-foreground ml-2 h-3.5 w-3.5" />
          </button>
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onDeleteAction(index)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <CollapsibleContent className="border-t px-3 py-3">{content}</CollapsibleContent>
    </Collapsible>
  )
}
