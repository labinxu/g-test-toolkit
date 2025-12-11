'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Trash2, RefreshCw, Save } from 'lucide-react'
import { resolveActionSubtypeLabel } from '../use-action-catalog'
import type { AdminAction, AdminPage, PageSummary } from '../types'
import { ActionForm } from '../../components/shared/action-form'
import { ScenarioStepsTable } from '../../components/shared/steps-table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AdminParam } from '../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  draft: AdminPage | null
  setDraft: (page: AdminPage | null) => void
  saving: boolean
  deleting: boolean
  loadingDetail: boolean
  onRefresh: () => void
  onSave: () => void
  onSaveAction?: (action: AdminAction) => void | Promise<void>
  onDelete: () => void
  onUpdateAction: (index: number, patch: Partial<AdminAction>) => void
  onDeleteAction: (index: number) => void
  onAddParam: (actionIndex: number) => void
  onUpdateParam: (actionIndex: number, paramIndex: number, patch: Partial<AdminParam>) => void
  onDeleteParam: (actionIndex: number, paramIndex: number) => void
  pages: PageSummary[]
  callSourcePageId: number | null
  setCallSourcePageId: (id: number | null) => void
  callSourceActionsByPageId: Record<number, AdminAction[]>
  loadCallSourceActions: (pageId: number) => Promise<AdminAction[]>
  loadingCallSource: boolean
}

export function PageDetailsSheet({
  open,
  onOpenChange,
  draft,
  setDraft,
  saving,
  deleting,
  loadingDetail,
  onRefresh,
  onSave,
  onSaveAction,
  onDelete,
  onUpdateAction,
  onDeleteAction,
  onAddParam,
  onUpdateParam,
  onDeleteParam,
  pages,
  callSourcePageId,
  setCallSourcePageId,
  callSourceActionsByPageId,
  loadCallSourceActions,
  loadingCallSource,
}: Props) {
  const currentActions = draft?.actions || []
  const [selectedActionIndex, setSelectedActionIndex] = useState(0)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<AdminAction | null>(null)

  useEffect(() => {
    if (!currentActions.length) {
      setSelectedActionIndex(0)
      return
    }
    if (selectedActionIndex >= currentActions.length) {
      setSelectedActionIndex(Math.max(0, currentActions.length - 1))
    }
  }, [currentActions.length, selectedActionIndex])

  const dialogAction = pendingAction ?? currentActions[selectedActionIndex]
  const isCreating = !!pendingAction

  const actionSteps = useMemo(() => {
    return currentActions.map((a, index) => {
      const params =
        (a.params || [])
          .map((p) => `${p.name}${p.required ? '*' : ''}`)
          .join(', ') || '—'
      const callSeq = (a.callSteps || [])
        .slice()
        .sort((x, y) => (x.sortOrder ?? 0) - (y.sortOrder ?? 0))
        .map((s, sIdx) => `#${sIdx + 1} ${s.targetActionKey}${s.args?.length ? `(${s.args.join(',')})` : ''}`)
        .join('；')
      const dataParts = [`参数: ${params}`]
      if (callSeq) dataParts.push(`内部调用: ${callSeq}`)
      const expected = a.returnTarget ? `返回: ${a.returnTarget}` : a.defaultExpected || ''
      return {
        id: `${a.id ?? 'new'}-${index}`,
        order: index + 1,
        action: `${a.label || a.key} · ${resolveActionSubtypeLabel(a)}`,
        data: dataParts.filter(Boolean).join(' | '),
        expected: expected || '—',
      }
    })
  }, [currentActions])

  const selectedAction = currentActions[selectedActionIndex]
  const actionDialogTitle =
    dialogAction != null
      ? `动作 ${
          pendingAction ? currentActions.length + 1 : selectedActionIndex + 1
        }${
          dialogAction.key
            ? ` (${dialogAction.key})`
            : dialogAction.method
              ? ` (${dialogAction.method})`
              : ''
        }`
      : '编辑动作'

  const handleMoveAction = (id: string, direction: 'up' | 'down') => {
    if (!draft) return
    const idx = actionSteps.findIndex((s) => s.id === id)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= currentActions.length) return
    const reordered = [...currentActions]
    const [item] = reordered.splice(idx, 1)
    reordered.splice(target, 0, item)
    setSelectedActionIndex(target)
    setDraft({ ...draft, actions: reordered })
  }

  const handleDeleteFromTable = (id: string) => {
    const idx = actionSteps.findIndex((s) => s.id === id)
    if (idx < 0) return
    onDeleteAction(idx)
    if (selectedActionIndex === idx) {
      setSelectedActionIndex(Math.max(0, idx - 1))
    }
  }

  const handleAddActionClick = () => {
    if (!draft) return
    const list = draft.actions || []
    const next: AdminAction = {
      key: '',
      label: '',
      method: '',
      actionType: 'click',
      kind: 'action',
      defaultExpected: null,
      description: null,
      enabled: true,
      sortOrder: list.length,
      params: [],
      callSteps: [],
    }
    setPendingAction(next)
    setSelectedActionIndex(list.length)
    setActionDialogOpen(true)
  }

  const handleUpdateActionInDialog = (index: number, patch: Partial<AdminAction>) => {
    if (pendingAction) {
      const nextKind = patch.kind ?? pendingAction.kind
      const nextActionType =
        nextKind === 'action'
          ? patch.actionType ?? pendingAction.actionType ?? 'click'
          : undefined
      setPendingAction({
        ...pendingAction,
        ...patch,
        kind: nextKind,
        actionType: nextActionType,
      })
      return
    }
    onUpdateAction(index, patch)
  }

  const handleDeleteActionInDialog = (index: number) => {
    if (pendingAction) {
      setPendingAction(null)
      setActionDialogOpen(false)
      return
    }
    onDeleteAction(index)
    setActionDialogOpen(false)
    setSelectedActionIndex((prev) => Math.max(0, prev - 1))
  }

  const handleAddParamInDialog = (actionIndex: number) => {
    if (pendingAction) {
      const params = pendingAction.params || []
      const nextParam: AdminParam = {
        name: '',
        type: 'string',
        required: false,
        placeholder: null,
        defaultValue: null,
        sortOrder: params.length,
      }
      setPendingAction({ ...pendingAction, params: [...params, nextParam] })
      return
    }
    onAddParam(actionIndex)
  }

  const handleUpdateParamInDialog = (
    actionIndex: number,
    paramIndex: number,
    patch: Partial<AdminParam>
  ) => {
    if (pendingAction) {
      const params = pendingAction.params || []
      const nextParams = params.map((p, i) => (i === paramIndex ? { ...p, ...patch } : p))
      setPendingAction({ ...pendingAction, params: nextParams })
      return
    }
    onUpdateParam(actionIndex, paramIndex, patch)
  }

  const handleDeleteParamInDialog = (actionIndex: number, paramIndex: number) => {
    if (pendingAction) {
      const params = pendingAction.params || []
      const next = params.filter((_, i) => i !== paramIndex).map((p, i) => ({ ...p, sortOrder: i }))
      setPendingAction({ ...pendingAction, params: next })
      return
    }
    onDeleteParam(actionIndex, paramIndex)
  }

  const handleConfirmActionDialog = async () => {
    try {
      if (pendingAction && draft) {
        const list = draft.actions || []
        const newAction: AdminAction = {
          ...pendingAction,
          sortOrder: Number.isFinite(pendingAction.sortOrder) ? pendingAction.sortOrder : list.length,
        }
        setDraft({ ...draft, actions: [...list, newAction] })
        if (onSaveAction) {
          await onSaveAction(newAction)
        } else {
          await onSave()
        }
      } else if (dialogAction && onSaveAction) {
        await onSaveAction(dialogAction)
      } else {
        await onSave()
      }
      setPendingAction(null)
      setActionDialogOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>页面与动作详情</SheetTitle>
          {draft?.id != null && (
            <SheetDescription>
              页面 ID：{draft.id}。为对应 Page 类配置 key、类名与动作列表，供用户场景步骤复用。
            </SheetDescription>
          )}
        </SheetHeader>
        <Card className="mt-3 flex min-h-0 flex-1 flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">页面与动作详情</CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">
                  为 shared-libs 中的 Page 类配置页面 key、类名与动作列表，供「用户场景」页面在添加步骤时复用。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={onRefresh}
                  aria-label="刷新详情"
                  disabled={!draft || loadingDetail}
                >
                  {loadingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  onClick={onSave}
                  disabled={saving || !draft}
                  aria-label="保存页面"
                  className="h-8 w-8"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={!draft?.id || deleting}
                  aria-label="删除页面"
                  className="h-8 w-8"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
            {!draft && (
              <p className="text-muted-foreground text-sm">
                请在左侧选择一个页面，或点击「+」新建页面。
              </p>
            )}
            {draft && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="ac-key" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      页面 key
                    </label>
                    <input
                      id="ac-key"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={draft.key}
                      onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                      placeholder="例如：live-stream"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ac-label" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      页面名称
                    </label>
                    <input
                      id="ac-label"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={draft.label}
                      onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                      placeholder="例如：直播 Studio（Web）"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ac-module" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      模块名（module）
                    </label>
                    <input
                      id="ac-module"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={draft.module}
                      onChange={(e) => setDraft({ ...draft, module: e.target.value })}
                      placeholder="gettr-web-lib"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ac-class" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Page 类名（className）
                    </label>
                    <input
                      id="ac-class"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={draft.className}
                      onChange={(e) => setDraft({ ...draft, className: e.target.value })}
                      placeholder="例如：LiveStreamPage"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ac-var" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      变量名（varName）
                    </label>
                    <input
                      id="ac-var"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={draft.varName}
                      onChange={(e) => setDraft({ ...draft, varName: e.target.value })}
                      placeholder="生成代码时使用的变量名，例如：live"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ac-sort" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      排序（sortOrder）
                    </label>
                    <input
                      id="ac-sort"
                      type="number"
                      className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={draft.sortOrder}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          sortOrder: Number(e.target.value || 0),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">动作列表</div>
                    <p className="text-muted-foreground text-xs">
                      每个动作会映射到 Page 类上的一个方法，用于「添加步骤」对话框与代码生成。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={handleAddActionClick}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <ScenarioStepsTable
                    steps={actionSteps}
                    mode="editable"
                    onEditStep={(id) => {
                      const idx = actionSteps.findIndex((s) => s.id === id)
                      if (idx >= 0) {
                        setSelectedActionIndex(idx)
                        setActionDialogOpen(true)
                      }
                    }}
                    onDeleteStep={(id) => handleDeleteFromTable(id)}
                    onMoveStep={(id, dir) => handleMoveAction(id, dir)}
                  />
                  {actionDialogOpen && dialogAction && (
                    <Dialog
                      open={actionDialogOpen}
                      onOpenChange={(open) => {
                        setActionDialogOpen(open)
                        if (!open) setPendingAction(null)
                      }}
                    >
                      <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>{isCreating ? '新增动作' : actionDialogTitle}</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[75vh] overflow-auto pr-1">
                          <ActionForm
                            key={`${dialogAction.id ?? (isCreating ? 'new' : 'edit')}-${selectedActionIndex}`}
                            action={dialogAction}
                            index={isCreating ? 0 : selectedActionIndex}
                            draft={draft}
                            pages={pages}
                            allActions={currentActions}
                            onUpdateAction={handleUpdateActionInDialog}
                            onDeleteAction={handleDeleteActionInDialog}
                            onAddParam={handleAddParamInDialog}
                            onUpdateParam={handleUpdateParamInDialog}
                            onDeleteParam={handleDeleteParamInDialog}
                            callSourcePageId={callSourcePageId}
                            setCallSourcePageId={setCallSourcePageId}
                            callSourceActionsByPageId={callSourceActionsByPageId}
                            loadCallSourceActions={loadCallSourceActions}
                            loadingCallSource={loadingCallSource}
                            collapsible={false}
                          />
                        </div>
                        <DialogFooter className="justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setActionDialogOpen(false)}>
                            取消
                          </Button>
                          <Button type="button" onClick={handleConfirmActionDialog} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '确定'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  {!currentActions.length && (
                    <p className="text-muted-foreground text-xs">
                      暂无动作，请点击上方「新增动作」按钮，为当前页面添加可复用的步骤动作。
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </SheetContent>
    </Sheet>
  )
}
