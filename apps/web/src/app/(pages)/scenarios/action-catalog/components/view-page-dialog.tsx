'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GTable } from '@/components/data-table'
import { resolveActionSubtypeLabel } from '../use-action-catalog'
import type { AdminPage } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  detail: AdminPage | null
}

export function ViewPageDialog({ open, onOpenChange, loading, detail }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val)
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="w-full max-w-full">
          <DialogTitle>页面配置预览</DialogTitle>
          <DialogDescription>
            从数据库中读取当前页面及其动作配置，只读展示，便于排查生成逻辑与数据库记录是否一致。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-w-full overflow-hidden">
          {loading && <p className="text-xs text-muted-foreground">加载中…</p>}
          {detail && (
            <>
              <div className="grid gap-2 text-xs md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">ID：</span>
                  <span>{detail.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">平台：</span>
                  <span>{detail.platform}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">页面 key：</span>
                  <span>{detail.key}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">名称：</span>
                  <span>{detail.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">模块：</span>
                  <span>{detail.module}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">类名：</span>
                  <span>{detail.className}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">变量名：</span>
                  <span>{detail.varName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">启用：</span>
                  <span>{detail.enabled ? '是' : '否'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">排序：</span>
                  <span>{detail.sortOrder}</span>
                </div>
              </div>
              <div className="w-full rounded-md border p-2">
                <GTable
                  caption="动作列表（来自数据库）"
                  headers={[
                    'ID',
                    'key',
                    '名称',
                    '方法',
                    '类型',
                    '启用',
                    '排序',
                    '参数',
                    '内部步骤数',
                  ]}
                  showFooter={false}
                  containerClassName="max-h-[50vh] overflow-x-auto overflow-y-auto"
                  rows={(detail.actions || []).map((a) => [
                    a.id ?? '',
                    a.key,
                    a.label,
                    a.method,
                    a.kind === 'assert'
                      ? '断言'
                      : a.kind === 'call'
                        ? '函数调用'
                        : resolveActionSubtypeLabel(a),
                    a.enabled ? '是' : '否',
                    a.sortOrder,
                    (Array.isArray((a as any).params) ? (a as any).params : [])
                      .map((p: any) => p.name)
                      .filter((name: string) => name)
                      .join(', '),
                    Array.isArray((a as any).callSteps)
                      ? (a as any).callSteps.length
                      : 0,
                  ])}
                />
              </div>
            </>
          )}
          {!loading && !detail && (
            <p className="text-xs text-muted-foreground">暂无数据，请在左侧选择页面并点击查看按钮。</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
