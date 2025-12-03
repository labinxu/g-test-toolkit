'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select'
import { OptionsSelectInput } from '@/components/select/options-select-input'
import { OptionsSelectSearch } from '@/components/select/options-select-search'
import ResizableStickyTable from '@/components/data-table'
import TablePagination from '@/components/table-pagination'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { GTable } from '@/components/g-table'
import { cn } from '@/lib/utils'
import { normalizeResponseError, isUnauthorizedError, ensureResponseOk } from '@/lib/error'
import { toast } from 'sonner'
import {
  ChevronsUpDown,
  Loader2,
  Trash2,
  RefreshCw,
  FileUp,
  FileText,
  FileCode,
  Plus,
  Save,
  ListChecks,
  Pencil,
  Flag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

type CaseStatus = 'draft' | 'in_progress' | 'ready' | 'code_generated'

export type UserScenarioSummary = {
  id: number
  code: string
  csvId?: string | null
  title: string
  module?: string | null
  platform?: string | null
  feature?: string | null
  submenu?: string | null
  priority?: 'P0' | 'P1' | 'P2'
  status: CaseStatus
  hasSteps: boolean
  hasCode: boolean
  description?: string | null
  acceptanceCriteria?: string | null
  generatedFilePath?: string | null
}

export type UserScenarioStep = {
  id: string
  order: number
  action: string
  data?: string
  expected: string
  binding?: string
}

type ActionParamDef = {
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}

type StepCheckRuleType = 'element-visible' | 'element-hidden' | 'url-contains' | 'url-equals'

type StepCheckRule = {
  type: StepCheckRuleType
  locator?: string
  expectedUrl?: string
  timeoutMs?: number
}

type PageActionDef = {
  key: string
  label: string
  method: string
  kind: 'action' | 'assert' | 'call'
  params?: ActionParamDef[]
  defaultExpected?: string
  locator?: string | null
  callSteps?: {
    targetActionKey: string
    args?: string[]
    sortOrder?: number
  }[]
}

type PageDef = {
  key: string
  label: string
  module: string
  className: string
  varName: string
  actions: PageActionDef[]
}

type ActionCatalog = {
  platform: string
  pages: PageDef[]
}

type StepBindingV1 = {
  ver: 1
  platform: string
  pageKey: string
  actionKey: string
  args?: { name: string; value: string }[]
  checkRule?: StepCheckRule
}

const STATUS_LABEL: Record<CaseStatus, string> = {
  draft: '草稿',
  in_progress: '完善中',
  ready: '已准备',
  code_generated: '已生成代码',
}

const PRIORITY_LABEL: Record<'P0' | 'P1' | 'P2', string> = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
}

const SUBMENU_LABEL: Record<string, string> = {
  host: '主播侧',
  viewer: '观众侧',
  interaction: '互动',
}

type StepParamHint = {
  summary: string
  example: string
}

type EnvTemplateSummary = {
  id: number
  platform: string
  driver: 'browser' | 'android' | 'ios' | 'other'
  key: string
  name: string
  description?: string | null
}

const getEnvTemplateStorageKey = (platform: string, driver: string): string =>
  `gtt:envTemplate:${platform || 'default'}:${driver || 'browser'}`

type ScenarioStepsTableProps = {
  steps: UserScenarioStep[]
  mode: 'readonly' | 'editable'
  getStepParamHint: (step: UserScenarioStep) => StepParamHint | null
  onEditStep: (id: string) => void
  onDeleteStep: (id: string) => void
  onMoveStep?: (id: string, direction: 'up' | 'down') => void
}

function ScenarioStepsTable({
  steps,
  mode,
  getStepParamHint,
  onEditStep,
  onDeleteStep,
  onMoveStep,
}: ScenarioStepsTableProps) {
  const [preFlagOn, setPreFlagOn] = useState<boolean>(() => {
    const first = steps[0]
    if (!first) return false
    // 默认：如果是通过“添加前置步骤”生成的占位行，则视为已选中
    return (
      first.order === 1 &&
      first.action === '前置条件' &&
      (!first.binding || !String(first.binding).trim())
    )
  })

  const [highlightStepId, setHighlightStepId] = useState<string | null>(null)

  useEffect(() => {
    if (!highlightStepId) return
    const timer = setTimeout(() => {
      setHighlightStepId(null)
    }, 800)
    return () => clearTimeout(timer)
  }, [highlightStepId])

  useEffect(() => {
    const first = steps[0]
    if (!first) {
      setPreFlagOn(false)
      return
    }
    if (
      first.order === 1 &&
      first.action === '前置条件' &&
      (!first.binding || !String(first.binding).trim())
    ) {
      setPreFlagOn(true)
    }
  }, [steps])

  const highlightRowIndex =
    highlightStepId != null ? steps.findIndex((step) => step.id === highlightStepId) : -1

  if (!steps.length) {
    return (
      <div className="text-muted-foreground py-2 text-center text-xs">
        暂无步骤，请点击右上角「添加步骤」为该用例补充执行路径。
      </div>
    )
  }

  const headers = ['', '顺序', '操作', '数据', '期望结果', ''] as const

  const rows = steps.map((s, index) => {
    const hint = getStepParamHint(s)
    const hasData = !!(s.data && s.data.trim())

    const isPrecondition = s.order === 1

    const isEditable = mode === 'editable' && !!onMoveStep

    const orderLabel = (
      <div className="flex items-center justify-end gap-1 pr-1">
        {isPrecondition && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreFlagOn((prev) => !prev)
                }}
              >
                <Flag
                  className={cn(
                    'h-3 w-3',
                    preFlagOn ? 'text-emerald-500' : 'text-muted-foreground'
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>前置条件步骤</TooltipContent>
          </Tooltip>
        )}
        <div className="flex items-center gap-1">
          {isEditable && (
            <div className="mr-1 flex flex-col items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                disabled={index === 0}
                onClick={() => {
                  onMoveStep?.(s.id, 'up')
                  setHighlightStepId(s.id)
                }}
                aria-label="上移步骤"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                disabled={index === steps.length - 1}
                onClick={() => {
                  onMoveStep?.(s.id, 'down')
                  setHighlightStepId(s.id)
                }}
                aria-label="下移步骤"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          )}
          <span className="inline-block w-[32px] text-right text-xs">{s.order}</span>
        </div>
      </div>
    )

    const dataText = hasData ? s.data : hint ? `参数：${hint.summary}` : '—'

    return [
      <Tooltip key="edit-tip">
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 cursor-grab active:cursor-grabbing"
            onClick={() => onEditStep(s.id)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>编辑步骤（页面 + 动作 + 参数）</TooltipContent>
      </Tooltip>,
      orderLabel,
      <Tooltip key="action">
        <TooltipTrigger asChild>
          <div className="line-clamp-2 text-xs whitespace-pre-wrap">{s.action || '—'}</div>
        </TooltipTrigger>
        {s.action && (
          <TooltipContent sideOffset={6} className="max-w-sm whitespace-pre-wrap">
            {s.action}
          </TooltipContent>
        )}
      </Tooltip>,
      <Tooltip key="data">
        <TooltipTrigger asChild>
          <div className="text-muted-foreground line-clamp-2 text-[11px] whitespace-pre-wrap">
            {dataText}
          </div>
        </TooltipTrigger>
        {(hasData || hint) && (
          <TooltipContent sideOffset={6} className="max-w-sm whitespace-pre-wrap">
            {hasData ? s.data : hint?.summary}
            {hint && hasData && (
              <div className="text-muted-foreground mt-1 text-[11px]">参数：{hint.summary}</div>
            )}
          </TooltipContent>
        )}
      </Tooltip>,
      <Tooltip key="expected">
        <TooltipTrigger asChild>
          <div className="line-clamp-2 text-xs whitespace-pre-wrap">{s.expected || '—'}</div>
        </TooltipTrigger>
        {s.expected && (
          <TooltipContent sideOffset={6} className="max-w-sm whitespace-pre-wrap">
            {s.expected}
          </TooltipContent>
        )}
      </Tooltip>,
      <Button
        key="delete"
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onDeleteStep(s.id)}
        aria-label="删除步骤"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>,
    ]
  })

  return (
    <GTable
      headers={headers as unknown as ReactNode[]}
      rows={rows}
      highlightRowIndex={highlightRowIndex >= 0 ? highlightRowIndex : null}
      onRowDoubleClick={(rowIndex) => {
        const step = steps[rowIndex]
        if (step) {
          onEditStep(step.id)
        }
      }}
      onSelectedRow={
        mode === 'readonly'
          ? (rowIndex) => {
              const step = steps[rowIndex]
              if (step) {
                onEditStep(step.id)
              }
            }
          : undefined
      }
    />
  )
}

export default function ScenariosPage() {
  const router = useRouter()
  const [cases, setCases] = useState<UserScenarioSummary[]>([])
  const [loadingCases, setLoadingCases] = useState(false)
  const [stepsByCase, setStepsByCase] = useState<Record<number, UserScenarioStep[]>>({})
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [ingestingDoc, setIngestingDoc] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [metaOpen, setMetaOpen] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [metaDialogOpen, setMetaDialogOpen] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(50)
  const [tableSelectedKeys, setTableSelectedKeys] = useState<Set<string>>(new Set())
  const [tableTotalRows, setTableTotalRows] = useState(0)
  const [tableFilteredRows, setTableFilteredRows] = useState(0)
  const [actionCatalog, setActionCatalog] = useState<ActionCatalog | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [stepDialogOpen, setStepDialogOpen] = useState(false)
  const [stepDialogPageKey, setStepDialogPageKey] = useState<string | undefined>(undefined)
  const [stepDialogActionKey, setStepDialogActionKey] = useState<string | undefined>(undefined)
  const [stepDialogArgs, setStepDialogArgs] = useState<Record<string, string>>({})
  const [stepDialogExpected, setStepDialogExpected] = useState('')
  const [stepDialogActionText, setStepDialogActionText] = useState('')
  const [stepDialogCheckType, setStepDialogCheckType] = useState<StepCheckRuleType | ''>('')
  const [stepDialogCheckLocator, setStepDialogCheckLocator] = useState('')
  const [stepDialogCheckExpectedUrl, setStepDialogCheckExpectedUrl] = useState('')
  const [stepDialogCheckTimeoutMs, setStepDialogCheckTimeoutMs] = useState('')
  const [editingStepIdForDialog, setEditingStepIdForDialog] = useState<string | null>(null)
  const [stepDialogOrder, setStepDialogOrder] = useState<number>(1)
  const [stepDialogApiMethod, setStepDialogApiMethod] = useState<string>('GET')
  const [stepDialogApiPath, setStepDialogApiPath] = useState<string>('')
  const [stepDialogApiBody, setStepDialogApiBody] = useState<string>('')
  const [envDialogOpen, setEnvDialogOpen] = useState(false)
  const [envDialogLoading, setEnvDialogLoading] = useState(false)
  const [envDialogTemplates, setEnvDialogTemplates] = useState<EnvTemplateSummary[]>([])
  const [envDialogCaseId, setEnvDialogCaseId] = useState<number | null>(null)
  const [envDialogSelectedId, setEnvDialogSelectedId] = useState<number | 'none' | null>('none')
  const [envDialogPlatform, setEnvDialogPlatform] = useState<string>('gettr-web')
  const [envDialogDriver, setEnvDialogDriver] = useState<'browser' | 'android' | 'ios' | 'other'>(
    'browser'
  )
  const [docAiPromptOpen, setDocAiPromptOpen] = useState(false)
  const [docAiPromptText, setDocAiPromptText] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return localStorage.getItem('gtt:scenarios:docAiHint') || ''
    } catch {
      return ''
    }
  })
  const [platform, setPlatform] = useState<string>(() => {
    if (typeof window === 'undefined') return 'gettr-web'
    try {
      return localStorage.getItem('gtt:scenarios:platform') || 'gettr-web'
    } catch {
      return 'gettr-web'
    }
  })
  const [platforms, setPlatforms] = useState<OptionsSelectItem<string>[]>([])
  const [newCaseOpen, setNewCaseOpen] = useState(false)
  const [newCaseSubmitting, setNewCaseSubmitting] = useState(false)
  const [newCaseCode, setNewCaseCode] = useState('')
  const [newCaseTitle, setNewCaseTitle] = useState('')
  const [newCaseFeature, setNewCaseFeature] = useState('')
  const [newCaseSubmenu, setNewCaseSubmenu] = useState<string | undefined>()
  const [newCasePriority, setNewCasePriority] = useState<'P0' | 'P1' | 'P2'>('P1')
  const [newCaseStatus, setNewCaseStatus] = useState<CaseStatus>('draft')
  const [newCaseDesc, setNewCaseDesc] = useState('')
  const [newCaseAcceptance, setNewCaseAcceptance] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editingSubmenu, setEditingSubmenu] = useState<string | null>(null)
  const [editingPriority, setEditingPriority] = useState<string | null>(null)
  const [editingModule, setEditingModule] = useState<string | null>(null)
  const [moduleItems, setModuleItems] = useState<OptionsSelectItem<string>[]>([])
  const [submenuItems, setSubmenuItems] = useState<OptionsSelectItem<string>[]>([])
  const [priorityItems, setPriorityItems] = useState<OptionsSelectItem<'P0' | 'P1' | 'P2'>[]>([])

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  )

  useEffect(() => {
    // 切换选中用例时，重置标题编辑缓存
    setEditingTitle(null)
    setEditingSubmenu(null)
    setEditingPriority(null)
    setEditingModule(null)
  }, [selectedCaseId])

  // Restore last selected case when coming back from Testcases (via gtt:scenarios:lastCaseId)
  useEffect(() => {
    if (!cases.length) return
    if (selectedCaseId != null) return
    try {
      const raw = localStorage.getItem('gtt:scenarios:lastCaseId')
      if (!raw) return
      const n = Number(raw)
      if (!Number.isFinite(n)) return
      const exists = cases.some((c) => c.id === n)
      if (exists) {
        setSelectedCaseId(n)
      }
    } catch {}
  }, [cases, selectedCaseId])

  useEffect(() => {
    if (selectedCaseId == null) return
    void loadCaseSteps(selectedCaseId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId])

  const filteredCases = useMemo(() => cases, [cases])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCases.length / Math.max(1, tablePageSize))),
    [filteredCases.length, tablePageSize]
  )
  const safePage = Math.max(1, Math.min(totalPages, tablePage))

  const currentSteps: UserScenarioStep[] = useMemo(() => {
    if (!selectedCase) return []
    return (stepsByCase[selectedCase.id] || []).slice().sort((a, b) => a.order - b.order)
  }, [selectedCase, stepsByCase])

  const apiPrefix = '/api/user-scenarios'
  const moduleLabelMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const it of moduleItems) {
      m[it.value] = it.label
    }
    return m
  }, [moduleItems])
  const statusItems: OptionsSelectItem<CaseStatus>[] = [
    { label: '草稿', value: 'draft' },
    { label: '完善中', value: 'in_progress' },
    { label: '已准备', value: 'ready' },
    { label: '已生成代码', value: 'code_generated' },
  ]

  const handleAddStep = () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例')
      return
    }
    const plat = (selectedCase.platform || platform || '').toString().toLowerCase()
    const isApiPlatform = plat.includes('-api-')

    if (isApiPlatform) {
      const caseId = selectedCase.id
      const list = stepsByCase[caseId] || []
      const nextOrder = list.length ? Math.max(...list.map((s) => s.order)) + 1 : 1
      setEditingStepIdForDialog(null)
      setStepDialogOrder(nextOrder)
      setStepDialogApiMethod('GET')
      setStepDialogApiPath('')
      setStepDialogApiBody('')
      setStepDialogActionText('')
      setStepDialogExpected('')
      setStepDialogPageKey(undefined)
      setStepDialogActionKey(undefined)
      setStepDialogArgs({})
      setStepDialogCheckType('')
      setStepDialogCheckLocator('')
      setStepDialogCheckExpectedUrl('')
      setStepDialogCheckTimeoutMs('')
      setStepDialogOpen(true)
      return
    }

    // 如果尚未加载动作目录，回退到手工模式
    if (!actionCatalog || !actionCatalog.pages?.length) {
      setStepsByCase((prev) => {
        const list = prev[selectedCase.id] || []
        const nextOrder = list.length ? Math.max(...list.map((s) => s.order)) + 1 : 1
        const next: UserScenarioStep = {
          id: `${selectedCase.id}-${Date.now()}`,
          order: nextOrder,
          action: '',
          expected: '',
        }
        return { ...prev, [selectedCase.id]: [...list, next] }
      })
      return
    }
    // 使用“页面 + 动作”对话框（新增模式）
    const firstPage = actionCatalog.pages[0]
    setEditingStepIdForDialog(null)
    setStepDialogPageKey(firstPage?.key)
    setStepDialogActionKey(undefined)
    setStepDialogArgs({})
    setStepDialogExpected('')
    setStepDialogActionText('')
    setStepDialogCheckType('')
    setStepDialogCheckLocator('')
    setStepDialogCheckExpectedUrl('')
    setStepDialogCheckTimeoutMs('')
    setStepDialogOpen(true)
  }

  const handleMockSaveCase = async () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例')
      return
    }
    const nextTitle = (editingTitle ?? selectedCase.title ?? '').trim()
    if (!nextTitle) {
      toast.error('标题不能为空')
      return
    }
    const rawModule = (editingModule ?? (selectedCase.module as string) ?? 'live-stream').trim()
    const nextModule = rawModule || 'live-stream'
    const rawSubmenu = (editingSubmenu ?? (selectedCase.submenu as string) ?? '').trim()
    const nextSubmenu = rawSubmenu || undefined
    const rawPriority = (editingPriority ?? (selectedCase.priority as string) ?? '').trim()
    let nextPriority: 'P0' | 'P1' | 'P2' = selectedCase.priority || 'P1'
    if (rawPriority === 'P0' || rawPriority === 'P1' || rawPriority === 'P2') {
      nextPriority = rawPriority
    }
    try {
      await updateCaseMeta({
        title: nextTitle,
        module: nextModule,
        submenu: nextSubmenu,
        priority: nextPriority,
      })
      setEditingTitle(null)
      setEditingSubmenu(null)
      setEditingPriority(null)
      setEditingModule(null)
    } catch {
      // updateCaseMeta 内部已经处理了 toast
    }
  }

  const handleDeleteStep = (stepId: string) => {
    if (!selectedCase) return
    setStepsByCase((prev) => {
      const list = prev[selectedCase.id] || []
      const next = list.filter((s) => s.id !== stepId)
      const normalized = next.map((s, index) => ({
        ...s,
        order: index + 1,
      }))
      return { ...prev, [selectedCase.id]: normalized }
    })
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) {
      toast.error('请先选择要删除的用户场景')
      return
    }
    const confirmed = window.confirm(
      `确认删除选中的 ${selectedIds.length} 个用户场景？将同时删除其所有步骤。`
    )
    if (!confirmed) return
    const idsToDelete = selectedIds.slice()
    try {
      setDeletingBulk(true)
      for (const id of idsToDelete) {
        const res = await fetch(`${apiPrefix}/${id}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const err = await normalizeResponseError(res as any)
          throw new Error(err.message || '删除用例失败')
        }
        setStepsByCase((prev) => {
          const { [id]: _removed, ...rest } = prev
          return rest
        })
      }
      if (selectedCaseId && idsToDelete.includes(selectedCaseId)) {
        setSelectedCaseId(null)
      }
      setSelectedIds([])
      setTableSelectedKeys(new Set())
      toast.success(`已删除选中的 ${idsToDelete.length} 个用户场景`)
      await refreshCases()
    } catch (e: any) {
      toast.error(e?.message || '批量删除用例失败')
    } finally {
      setDeletingBulk(false)
    }
  }

  const handleAddPreconditionStep = () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例')
      return
    }
    setStepsByCase((prev) => {
      const caseId = selectedCase.id
      const list = (prev[caseId] || []).slice().sort((a, b) => a.order - b.order)
      // 如果已经存在一个无 binding 的步骤，则不重复添加，只保留现有数据
      const existingPre = list.find((s) => !s.binding || !String(s.binding).trim())
      if (existingPre) {
        return prev
      }
      // 先规范化现有步骤的顺序，从 1 开始
      const normalized = list.map((s, idx) => ({
        ...s,
        order: idx + 1,
      }))
      const preStep: UserScenarioStep = {
        id: `${caseId}-pre-${Date.now()}`,
        order: 1,
        action: '前置条件',
        data: '',
        expected: '',
        binding: '',
      }
      const shifted = normalized.map((s) => ({
        ...s,
        order: s.order + 1,
      }))
      return { ...prev, [caseId]: [preStep, ...shifted] }
    })
  }

  const getStepParamHint = (
    step: UserScenarioStep
  ): { summary: string; example: string } | null => {
    if (!actionCatalog || !step.binding) return null
    let parsed: StepBindingV1 | null = null
    try {
      parsed = JSON.parse(step.binding) as StepBindingV1
    } catch {
      return null
    }
    if (!parsed || !parsed.pageKey || !parsed.actionKey) return null
    const page = (actionCatalog.pages || []).find((p) => p.key === parsed!.pageKey)
    if (!page) return null
    const action = (page.actions || []).find((a) => a.key === parsed!.actionKey)
    if (!action) return null
    const params = action.params || []
    if (!params.length) return null
    const parts = params.map((p) => {
      const type = (p.type || 'string').toString()
      return `${p.name}(${type})`
    })
    const example = params.map((p) => `${p.name}=...`).join(', ')
    return {
      summary: parts.join(', '),
      example,
    }
  }

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    if (!selectedCase) return
    setStepsByCase((prev) => {
      const caseId = selectedCase.id
      const list = (prev[caseId] || []).slice().sort((a, b) => a.order - b.order)
      const index = list.findIndex((s) => s.id === stepId)
      if (index === -1) return prev
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= list.length) return prev
      const reordered = list.slice()
      const [item] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, item)
      const normalized = reordered.map((s, idx) => ({
        ...s,
        order: idx + 1,
      }))
      return { ...prev, [caseId]: normalized }
    })
  }

  const handleEditStepInDialog = (stepId: string) => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例')
      return
    }
    const plat = (selectedCase.platform || platform || '').toString().toLowerCase()
    const isApiPlatform = plat.includes('-api-')
    const list = stepsByCase[selectedCase.id] || []
    const step = list.find((s) => s.id === stepId)
    if (!step) return

    // 对于 API 平台（如 gettr-api-*），不依赖页面动作目录，直接编辑步骤文本
    if (isApiPlatform) {
      // 解析 data 字段中的简单 key=value 对，支持 method/path/body
      let method = 'GET'
      let pathVal = ''
      let bodyVal = ''
      const rawData = (step.data || '').toString()
      if (rawData.trim()) {
        for (const part of rawData.split(',')) {
          const seg = part.trim()
          if (!seg) continue
          const eqIdx = seg.indexOf('=')
          if (eqIdx <= 0) continue
          const name = seg
            .slice(0, eqIdx)
            .trim()
            .toLowerCase()
          const value = seg.slice(eqIdx + 1).trim()
          if (name === 'method') {
            method = value || method
          } else if (name === 'path') {
            pathVal = value
          } else if (name === 'body' || name === 'payload') {
            bodyVal = value
          }
        }
      }
      setEditingStepIdForDialog(stepId)
      setStepDialogPageKey(undefined)
      setStepDialogActionKey(undefined)
      setStepDialogArgs({})
      setStepDialogExpected(step.expected || '')
      setStepDialogActionText(step.action || '')
      setStepDialogCheckType('')
      setStepDialogCheckLocator('')
      setStepDialogCheckExpectedUrl('')
      setStepDialogCheckTimeoutMs('')
      setStepDialogOrder(Number.isFinite(step.order) ? step.order : 1)
      setStepDialogApiMethod(method || 'GET')
      setStepDialogApiPath(pathVal)
      setStepDialogApiBody(bodyVal)
      setStepDialogOpen(true)
      return
    }

    if (!actionCatalog || !actionCatalog.pages?.length) {
      toast.error('页面动作目录尚未加载，无法使用绑定编辑')
      return
    }

    let binding: StepBindingV1 | null = null
    try {
      if (step.binding) {
        binding = JSON.parse(step.binding) as StepBindingV1
      }
    } catch {
      binding = null
    }
    const catalog = actionCatalog
    let pageKey: string | undefined
    let actionKey: string | undefined
    let argsFromBinding: Record<string, string> = {}

    if (binding && binding.pageKey && binding.actionKey) {
      pageKey = binding.pageKey
      actionKey = binding.actionKey
      if (Array.isArray(binding.args)) {
        for (const arg of binding.args) {
          if (!arg || !arg.name) continue
          argsFromBinding[arg.name] = arg.value ?? ''
        }
      }
    }

    const pages = catalog.pages || []
    const resolvedPage = (pageKey && pages.find((p) => p.key === pageKey)) || pages[0] || null

    const resolvedAction =
      resolvedPage &&
      ((actionKey && resolvedPage.actions.find((a) => a.key === actionKey)) ||
        resolvedPage.actions[0] ||
        null)

    if (!resolvedPage || !resolvedAction) {
      toast.error('当前步骤未绑定到可解析的页面/动作，请重新选择')
      setEditingStepIdForDialog(null)
      setStepDialogPageKey(pages[0]?.key)
      setStepDialogActionKey(undefined)
      setStepDialogArgs({})
      setStepDialogExpected(step.expected || '')
      setStepDialogOrder(Number.isFinite(step.order) ? step.order : 1)
      setStepDialogOpen(true)
      return
    }

    const paramArgs: Record<string, string> = {}
    const params = resolvedAction.params || []
    // 先用 binding.args，缺失的尝试从 data 文本中回填
    const mapFromData: Record<string, string> = {}
    const rawData = (step.data || '').toString()
    if (rawData.trim()) {
      for (const part of rawData.split(',')) {
        const seg = part.trim()
        if (!seg) continue
        const eqIdx = seg.indexOf('=')
        if (eqIdx <= 0) continue
        const n = seg.slice(0, eqIdx).trim()
        const v = seg.slice(eqIdx + 1).trim()
        if (n) mapFromData[n] = v
      }
    }
    for (const p of params) {
      const name = p.name
      if (argsFromBinding[name] != null) {
        paramArgs[name] = argsFromBinding[name]
      } else if (mapFromData[name] != null) {
        paramArgs[name] = mapFromData[name]
      } else {
        paramArgs[name] = ''
      }
    }

    let checkType: StepCheckRuleType | '' = ''
    let checkLocator = ''
    let checkExpectedUrl = ''
    let checkTimeout = ''

    if (binding && (binding as any).checkRule && typeof (binding as any).checkRule === 'object') {
      const rule = (binding as any).checkRule as StepCheckRule
      if (
        rule.type === 'element-visible' ||
        rule.type === 'element-hidden' ||
        rule.type === 'url-contains' ||
        rule.type === 'url-equals'
      ) {
        checkType = rule.type
      }
      if (typeof rule.locator === 'string') {
        checkLocator = rule.locator
      }
      if (typeof rule.expectedUrl === 'string') {
        checkExpectedUrl = rule.expectedUrl
      }
      if (typeof rule.timeoutMs === 'number' && Number.isFinite(rule.timeoutMs) && rule.timeoutMs > 0) {
        checkTimeout = String(rule.timeoutMs)
      }
    }

    if (!checkType && resolvedAction.kind === 'assert') {
      const locRaw = (resolvedAction as any).locator as string | null | undefined
      if (locRaw && locRaw.trim()) {
        checkType = 'element-visible'
        checkLocator = locRaw.trim()
      }
    }

    setEditingStepIdForDialog(stepId)
    setStepDialogPageKey(resolvedPage.key)
    setStepDialogActionKey(resolvedAction.key)
    setStepDialogArgs(paramArgs)
    setStepDialogExpected(step.expected || resolvedAction.defaultExpected || '')
    setStepDialogActionText(step.action || '')
    setStepDialogCheckType(checkType)
    setStepDialogCheckLocator(checkLocator)
    setStepDialogCheckExpectedUrl(checkExpectedUrl)
    setStepDialogCheckTimeoutMs(checkTimeout)
    setStepDialogOpen(true)
  }

  const handleDeleteCase = async (id: number) => {
    const confirmed = window.confirm('确认删除该用户场景？将同时删除其所有步骤。')
    if (!confirmed) return
    try {
      setDeletingId(id)
      const res = await fetch(`${apiPrefix}/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '删除用例失败')
      }
      setStepsByCase((prev) => {
        const { [id]: _removed, ...rest } = prev
        return rest
      })
      if (selectedCaseId === id) {
        setSelectedCaseId(null)
      }
      setTableSelectedKeys((prev) => {
        const next = new Set(prev)
        next.delete(`id:${id}`)
        return next
      })
      toast.success('已删除该用户场景')
      await refreshCases()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '删除用例失败')
      }
    } finally {
      setDeletingId((curr) => (curr === id ? null : curr))
    }
  }

  const handleSaveSteps = async () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例')
      return
    }
    const steps = currentSteps.map((s) => {
      let nextBinding = s.binding
      if (nextBinding) {
        try {
          const parsed = JSON.parse(nextBinding) as StepBindingV1
          if (parsed && Array.isArray(parsed.args)) {
            const map: Record<string, string> = {}
            const raw = (s.data || '').toString()
            if (raw.trim()) {
              for (const part of raw.split(',')) {
                const seg = part.trim()
                if (!seg) continue
                const eqIdx = seg.indexOf('=')
                if (eqIdx <= 0) continue
                const name = seg.slice(0, eqIdx).trim()
                const value = seg.slice(eqIdx + 1).trim()
                if (name) {
                  map[name] = value
                }
              }
            }
            if (Object.keys(map).length) {
              parsed.args = parsed.args.map((arg) => ({
                ...arg,
                value: map[arg.name] ?? arg.value ?? '',
              }))
            }
          }
          nextBinding = JSON.stringify(parsed)
        } catch {
          // ignore parse errors, keep original binding
        }
      }
      return {
        order: Number.isFinite(s.order) ? s.order : 1,
        action: s.action,
        data: s.data,
        expected: s.expected,
        binding: nextBinding,
      }
    })
    try {
      const res = await fetch(`${apiPrefix}/${selectedCase.id}/steps`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ steps }),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '保存步骤失败')
      }
      toast.success('已保存步骤')
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '保存步骤失败')
      }
    }
  }

  const openEnvTemplateDialogForCase = async (
    caseId: number,
    casePlatform?: string | null
  ) => {
    const rawPlatform = (casePlatform || platform || 'gettr-web').toString().trim()
    const p = rawPlatform || 'gettr-web'
    const d: 'browser' | 'android' | 'ios' | 'other' =
      p === 'gettr-android' ? 'android' : p.includes('-api-') ? 'other' : 'browser'
    setEnvDialogCaseId(caseId)
    setEnvDialogPlatform(p)
    setEnvDialogDriver(d)
    setEnvDialogSelectedId('none')
    setEnvDialogOpen(true)
    setEnvDialogLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('platform', p)
      qs.set('driver', d)
      const res = await fetch(`/api/env-templates?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '加载环境模板失败')
      }
      const data = await res.json()
      const list: any[] = Array.isArray(data?.items) ? data.items : []
      const mapped: EnvTemplateSummary[] = list.map((it) => ({
        id: Number(it.id),
        platform: String(it.platform || p),
        driver: (it.driver || d) as 'browser' | 'android' | 'ios' | 'other',
        key: String(it.key || ''),
        name: String(it.name || it.key || ''),
        description: (it.description as string | null | undefined) ?? null,
      }))
      setEnvDialogTemplates(mapped)
      if (mapped.length === 1) {
        setEnvDialogSelectedId(mapped[0]!.id)
      } else if (mapped.length > 1) {
        try {
          const key = getEnvTemplateStorageKey(p, d)
          const raw = localStorage.getItem(key)
          if (raw) {
            const lastId = Number(raw)
            if (Number.isFinite(lastId) && mapped.some((tpl) => tpl.id === lastId)) {
              setEnvDialogSelectedId(lastId)
            }
          }
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '加载环境模板失败')
      }
      setEnvDialogTemplates([])
    } finally {
      setEnvDialogLoading(false)
    }
  }

  const generateCodeForCase = async (caseId: number, envTemplateId?: number | null) => {
    try {
      const res = await fetch(`${apiPrefix}/${caseId}/generate-code`, {
        method: 'POST',
        headers: envTemplateId ? { 'content-type': 'application/json' } : undefined,
        body: envTemplateId ? JSON.stringify({ envTemplateId }) : undefined,
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '生成代码失败')
      }
      const data = await res.json()
      const filePath = (data?.filePath as string) || ''
      if (filePath) {
        toast.success(
          <div className="flex flex-col gap-1">
            <div className="break-all text-xs">已生成代码：{filePath}</div>
            <div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  router.push('/testcases')
                }}
              >
                在「用例库」中打开
              </Button>
            </div>
          </div>
        )
      } else {
        toast.success(data?.message || '已触发代码生成')
      }
      try {
        if (filePath) {
          localStorage.setItem('gtt:testcases:lastFile', filePath)
          localStorage.setItem('gtt:testcases:forceReload', '1')
        }
      } catch {}
      await refreshCases()
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '生成代码失败')
      }
    }
  }

  const handleGenerateCode = async () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例')
      return
    }
    await openEnvTemplateDialogForCase(selectedCase.id, selectedCase.platform || platform)
  }

  const refreshCases = async () => {
    try {
      setLoadingCases(true)
      const qs = new URLSearchParams()
      if (platform) qs.set('platform', platform)
      const res = await fetch(`${apiPrefix}?${qs.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '获取用例列表失败')
      }
      const data = (await res.json()) as UserScenarioSummary[]
      setCases(data || [])
      if (!selectedCaseId && data.length) {
        // 默认选中第一条，用于首次加载
        setSelectedCaseId(data[0].id)
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取用例列表失败')
      }
    } finally {
      setLoadingCases(false)
    }
  }

  const fetchActionCatalog = async () => {
    try {
      setLoadingCatalog(true)
      const res = await fetch(
        `${apiPrefix}/action-catalog?platform=${encodeURIComponent(platform || 'gettr-web')}`,
        {
          cache: 'no-store',
        }
      )
      await ensureResponseOk(res, {
        defaultMessage: '获取页面动作目录失败',
        onUnauthorized: () => {
          try {
            router.push('/signin')
          } catch {
            // ignore navigation errors
          }
        },
      })
      const data = await res.json()
      const catalog: ActionCatalog | null =
        (data && (data.catalog as ActionCatalog)) ||
        (data?.platform ? (data as ActionCatalog) : null)
      if (catalog && Array.isArray(catalog.pages)) {
        setActionCatalog(catalog)
      }
    } catch (e: any) {
      // 加载失败不影响主流程；鉴权错误已跳转登录页，不再打印
      if (isUnauthorizedError(e)) {
        return
      }
      // 其它错误仅在控制台提示，避免打断主流程
      // eslint-disable-next-line no-console
      console.error(e?.message || e)
    } finally {
      setLoadingCatalog(false)
    }
  }

  const updateCaseMeta = async (patch: {
    title?: string
    status?: CaseStatus
    submenu?: string
    priority?: 'P0' | 'P1' | 'P2'
    platform?: string
  }) => {
    if (!selectedCase) {
      toast.error('请先选择一个用例')
      return
    }
    try {
      const res = await fetch(`${apiPrefix}/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '更新用例失败')
      }
      await refreshCases()
      toast.success('已更新用例信息')
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '更新用例失败')
      }
    }
  }

  const loadCaseSteps = async (caseId: number) => {
    try {
      const res = await fetch(`${apiPrefix}/${caseId}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin')
          } catch {}
          throw new Error('Unauthorized')
        }
        throw new Error(err.message || '获取用例详情失败')
      }
      const data = await res.json()
      const steps: UserScenarioStep[] = (data?.steps || []).map((s: any) => ({
        id: String(s.id),
        order: s.order,
        action: s.action || '',
        data: s.data || '',
        expected: s.expected || '',
        binding: s.binding || '',
      }))
      setStepsByCase((prev) => ({ ...prev, [caseId]: steps }))
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取用例详情失败')
      }
    }
  }

  useEffect(() => {
    void refreshCases()
    void fetchActionCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])

  const loadPlatforms = async () => {
    try {
      const res = await fetch('/api/action-catalog/platforms', {
        cache: 'no-store',
      })
      if (!res.ok) {
        return
      }
      const data = await res.json()
      const items = Array.isArray(data?.items) ? data.items : []
      const optsBase: OptionsSelectItem<string>[] = items.map((p: any) => ({
        value: p.key as string,
        label: (p.label as string) || (p.key as string),
      }))
      const hasApiLivestream = optsBase.some((p) => p.value === 'gettr-api-livestream')
      const opts: OptionsSelectItem<string>[] = hasApiLivestream
        ? optsBase
        : optsBase.concat([
            {
              value: 'gettr-api-livestream',
              label: 'GETTR API (Livestream)',
            },
          ])
      setPlatforms(opts)
      if (!platform && opts.length) {
        const def =
          opts.find((p) => p.value === 'gettr-web')?.value || opts[0]?.value || 'gettr-web'
        setPlatform(def)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadPlatforms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const kinds: Array<'module' | 'submenu' | 'priority'> = ['module', 'submenu', 'priority']
        for (const kind of kinds) {
          const res = await fetch(`${apiPrefix}/options?kind=${kind}`, {
            cache: 'no-store',
          })
          if (!res.ok) continue
          const data = await res.json()
          const items: OptionsSelectItem<string>[] = Array.isArray(data?.items) ? data.items : []
          if (kind === 'module') {
            setModuleItems(items)
          } else if (kind === 'submenu') {
            setSubmenuItems(items)
          } else if (kind === 'priority') {
            const casted = items.map(
              (it) =>
                ({
                  value: (it.value as 'P0' | 'P1' | 'P2') ?? 'P1',
                  label: it.label,
                }) as OptionsSelectItem<'P0' | 'P1' | 'P2'>
            )
            setPriorityItems(
              casted.length
                ? casted
                : [
                    { value: 'P0', label: 'P0' },
                    { value: 'P1', label: 'P1' },
                    { value: 'P2', label: 'P2' },
                  ]
            )
          }
        }
        if (!priorityItems.length) {
          setPriorityItems([
            { value: 'P0', label: 'P0' },
            { value: 'P1', label: 'P1' },
            { value: 'P2', label: 'P2' },
          ])
        }
      } catch {
        // ignore
      }
    }
    void loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateCase = async () => {
    if (!newCaseCode.trim()) {
      toast.error('用例编号不能为空')
      return
    }
    if (!newCaseTitle.trim()) {
      toast.error('标题不能为空')
      return
    }
    try {
      setNewCaseSubmitting(true)
      const payload: any = {
        code: newCaseCode.trim(),
        title: newCaseTitle.trim(),
        feature: newCaseFeature.trim() || undefined,
        submenu: newCaseSubmenu || undefined,
        priority: newCasePriority,
        status: newCaseStatus,
        platform: platform || 'gettr-web',
        description: newCaseDesc.trim() || undefined,
        acceptanceCriteria: newCaseAcceptance.trim() || undefined,
      }
      const res = await fetch(apiPrefix, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '创建用户场景失败')
      }
      const created = (await res.json()) as UserScenarioSummary
      toast.success('已创建用户场景')
      setNewCaseOpen(false)
      await refreshCases()
      if (created?.id) {
        setSelectedCaseId(created.id)
      }
    } catch (e: any) {
      toast.error(e?.message || '创建用户场景失败')
    } finally {
      setNewCaseSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div>
        <h1 className="text-2xl font-semibold">用户场景管理</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          可从结构化 CSV（推荐使用 Livestream CSV 模板）或说明文档/设计文档导入用例草稿，在此补充详细步骤与检查点，并生成 workspace 测试代码。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          <Card className="flex min-h-0 flex-1 flex-col gap-2 py-1">
            <CardHeader className="space-y-3" />
            <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      disabled={loadingCases}
                      onClick={refreshCases}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>刷新列表</TooltipContent>
                </Tooltip>
                <div className="flex flex-wrap items-center gap-1.5">
                  <form className="flex items-center gap-1.5" onSubmit={(e) => e.preventDefault()}>
                    <input
                      id="ls-upload-csv"
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        try {
                          const formData = new FormData()
                          formData.append('file', file)
                          formData.append('platform', platform || 'gettr-web')
                          const res = await fetch(`${apiPrefix}/sync-from-csv-upload`, {
                            method: 'POST',
                            body: formData,
                          })
                          if (!res.ok) {
                            const err = await normalizeResponseError(res as any)
                            throw new Error(err.message || '上传 CSV 失败')
                          }
                          const data = await res.json()
                          toast.success(
                            data?.message ||
                              `导入完成：新增 ${data?.created ?? 0} 条，更新 ${
                                data?.updated ?? 0
                              } 条`
                          )
                          await refreshCases()
                        } catch (e: any) {
                          toast.error(e?.message || '上传 CSV 失败')
                        } finally {
                          event.target.value = ''
                        }
                      }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => {
                            const input = document.getElementById(
                              'ls-upload-csv'
                            ) as HTMLInputElement | null
                            input?.click()
                          }}
                        >
                          <FileUp className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        从结构化 CSV 导入（要求符合 Livestream CSV 模板）
                      </TooltipContent>
                    </Tooltip>
                  </form>
                  <form className="flex items-center gap-1.5" onSubmit={(e) => e.preventDefault()}>
                    <input
                      id="ls-upload-doc"
                      type="file"
                      accept=".csv,text/csv,.txt,.md,.markdown,.log"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        setIngestingDoc(true)
                        const toastAny = toast as any
                        let progressId: any = null
                        let refreshId: any = null
                        if (toastAny) {
                          progressId =
                            toastAny.message?.(
                              '步骤 1/2：已上传用例说明表（CSV/文档），正在解析生成用户场景，这一步通常需要 10～60 秒，请稍候…',
                              { duration: 120000 }
                            ) ??
                            toastAny(
                              '步骤 1/2：已上传用例说明表（CSV/文档），正在解析生成用户场景，这一步通常需要 10～60 秒，请稍候…',
                              { duration: 120000 }
                            )
                        }
                        try {
                          const formData = new FormData()
                          formData.append('file', file)
                          formData.append('project', 'live-stream')
                          formData.append('docType', 'livekit')
                          formData.append('sourceDoc', file.name || 'livekit')
                          formData.append('platform', platform || 'gettr-web')
                          if (docAiPromptText && docAiPromptText.trim()) {
                            formData.append('aiHint', docAiPromptText.trim())
                          }
                          const res = await fetch(`${apiPrefix}/ingest-doc-upload`, {
                            method: 'POST',
                            body: formData,
                          })
                          if (!res.ok) {
                            const err = await normalizeResponseError(res as any)
                            throw new Error(err.message || '从说明文档导入失败')
                          }
                          if (progressId != null && toastAny?.dismiss) {
                            toastAny.dismiss(progressId)
                            progressId = null
                          }
                          if (toastAny) {
                            refreshId =
                              toastAny.message?.(
                                '步骤 2/2：解析完成，正在写入用户场景并刷新列表…',
                                { duration: 60000 }
                              ) ??
                              toastAny('步骤 2/2：解析完成，正在写入用户场景并刷新列表…', {
                                duration: 60000,
                              })
                          }
                          const data = await res.json()
                          await refreshCases()
                          if (refreshId != null && toastAny?.dismiss) {
                            toastAny.dismiss(refreshId)
                            refreshId = null
                          }
                          toast.success(
                            data?.message ||
                              `从说明文档导入完成：新增 ${
                                data?.created ?? 0
                              } 条，更新 ${data?.updated ?? 0} 条`
                          )
                        } catch (e: any) {
                          toast.error(e?.message || '从说明文档导入失败')
                        } finally {
                          event.target.value = ''
                          setIngestingDoc(false)
                          if (progressId != null && toastAny?.dismiss) {
                            toastAny.dismiss(progressId)
                          }
                          if (refreshId != null && toastAny?.dismiss) {
                            toastAny.dismiss(refreshId)
                          }
                        }
                      }}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          disabled={ingestingDoc}
                          onClick={() => {
                            if (ingestingDoc) return
                            setDocAiPromptOpen(true)
                          }}
                        >
                          {ingestingDoc ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>
                        从说明文档/设计文档导入（支持 md/txt/csv，自动解析为用例草稿）
                      </TooltipContent>
                    </Tooltip>
                  </form>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <OptionsSelect
                    id="ls-platform"
                    value={platform}
                    items={
                      platforms.length ? platforms : [{ value: 'gettr-web', label: 'GETTR Web' }]
                    }
                    placeholder="平台"
                    onSelect={(item) => {
                      setPlatform(item.value)
                      try {
                        localStorage.setItem('gtt:scenarios:platform', item.value)
                      } catch {}
                      setSelectedCaseId(null)
                      setStepsByCase({})
                    }}
                    triggerClassName="h-8 min-w-[140px]"
                  />
                </div>
                {ingestingDoc && (
                  <p className="text-muted-foreground max-w-xl text-[11px]">
                    导入中：后端正在解析说明文档并写入用户场景，通常需要 10～60
                    秒，完成后列表会自动刷新…
                  </p>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <TablePagination
                    page={tablePage}
                    totalPages={totalPages}
                    totalRows={tableFilteredRows || filteredCases.length}
                    pageSize={tablePageSize}
                    pageSizeMin={10}
                    pageSizeMax={200}
                    onPageChange={(p) => setTablePage(p)}
                    onPageSizeChange={(size) => {
                      setTablePageSize(size)
                      setTablePage(1)
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          type="button"
                          onClick={() => {
                            setNewCaseCode('')
                            setNewCaseTitle('')
                            setNewCaseFeature('')
                            setNewCaseSubmenu(undefined)
                            setNewCasePriority('P1')
                            setNewCaseStatus('draft')
                            setNewCaseDesc('')
                            setNewCaseAcceptance('')
                            setNewCaseOpen(true)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>新增用例</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          disabled={!selectedIds.length || deletingBulk}
                          onClick={handleDeleteSelected}
                          type="button"
                        >
                          {deletingBulk ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>删除所选</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <ResizableStickyTable<UserScenarioSummary>
                    rows={filteredCases}
                    columns={useMemo(
                      () => [
                        {
                          key: 'code',
                          header: '用例ID',
                          width: 80,
                          minWidth: 72,
                          sticky: 'left' as const,
                          filterType: 'text' as const,
                          filterPlaceholder: '按用例ID筛选',
                          render: (row: UserScenarioSummary) => (
                            <button
                              type="button"
                              className={cn(
                                'w-full truncate text-left',
                                selectedCaseId === row.id && 'font-semibold'
                              )}
                              onClick={() => setSelectedCaseId(row.id)}
                            >
                              {row.code}
                            </button>
                          ),
                        },
                        {
                          key: 'title',
                          header: '标题',
                          width: 220,
                          minWidth: 160,
                          filterType: 'text' as const,
                          filterPlaceholder: '按标题筛选',
                          render: (row: UserScenarioSummary) => (
                            <button
                              type="button"
                              className={cn(
                                'w-full truncate text-left',
                                selectedCaseId === row.id && 'font-semibold'
                              )}
                              title={row.title}
                              onClick={() => setSelectedCaseId(row.id)}
                            >
                              {row.title}
                            </button>
                          ),
                        },
                        {
                          key: 'module',
                          header: '业务模块',
                          width: 120,
                          minWidth: 96,
                          filterType: 'select' as const,
                          accessor: (row: UserScenarioSummary) =>
                            row.module ? moduleLabelMap[row.module] || row.module : '',
                        },
                        {
                          key: 'submenu',
                          header: '角色 / Persona',
                          width: 80,
                          minWidth: 72,
                          filterType: 'select' as const,
                          accessor: (row: UserScenarioSummary) =>
                            row.submenu ? SUBMENU_LABEL[row.submenu] || row.submenu : '-',
                        },
                        {
                          key: 'priority',
                          header: '优先级',
                          width: 72,
                          minWidth: 64,
                          filterType: 'select' as const,
                          accessor: (row: UserScenarioSummary) =>
                            row.priority ? PRIORITY_LABEL[row.priority] : '',
                        },
                        {
                          key: 'status',
                          header: '状态',
                          width: 80,
                          minWidth: 72,
                          filterType: 'select' as const,
                          accessor: (row: UserScenarioSummary) => STATUS_LABEL[row.status],
                        },
                        {
                          key: 'actions',
                          header: '',
                          width: 156,
                          minWidth: 132,
                          render: (row: UserScenarioSummary) => (
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setSelectedCaseId(row.id)
                                      setDetailsOpen(true)
                                    }}
                                    aria-label="编辑步骤"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>编辑步骤</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setSelectedCaseId(row.id)
                                      setMetaDialogOpen(true)
                                    }}
                                    aria-label="编辑基本信息"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>编辑基本信息</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      void openEnvTemplateDialogForCase(
                                        row.id,
                                        row.platform || platform
                                      )
                                    }
                                    aria-label="为该用例生成代码"
                                  >
                                    <FileCode className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>为该用例生成代码</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {(() => {
                                    const canOpen =
                                      row.status === 'code_generated' &&
                                      !!row.generatedFilePath &&
                                      row.generatedFilePath.trim().length > 0
                                    return (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={!canOpen}
                                        onClick={() => {
                                          if (!canOpen) return
                                          const path = (row.generatedFilePath || '').trim()
                                          try {
                                            if (path) {
                                              localStorage.setItem('gtt:testcases:lastFile', path)
                                            }
                                          } catch {}
                                          router.push('/testcases')
                                        }}
                                        aria-label="在用例库中打开生成代码"
                                      >
                                        <ExternalLink
                                          className={cn(
                                            'h-3.5 w-3.5',
                                            !canOpen && 'opacity-30 cursor-default'
                                          )}
                                        />
                                      </Button>
                                    )
                                  })()}
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>
                                  在「用例库」中打开生成代码
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive h-7 w-7"
                                    disabled={deletingId === row.id}
                                    onClick={() => void handleDeleteCase(row.id)}
                                    aria-label="删除用户场景"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>删除用例</TooltipContent>
                              </Tooltip>
                            </div>
                          ),
                        },
                      ],
                      [selectedCaseId, deletingId, moduleLabelMap]
                    )}
                    getRowKey={(row) => `id:${row.id}`}
                    page={safePage}
                    pageSize={tablePageSize}
                    density="compact"
                    selection={{
                      enabled: true,
                      keys: tableSelectedKeys,
                      onChange: (keys) => {
                        setTableSelectedKeys(keys)
                        const ids: number[] = []
                        for (const k of keys) {
                          const parts = k.split(':')
                          const n = Number(parts[1] ?? parts[0])
                          if (Number.isFinite(n)) ids.push(n)
                        }
                        setSelectedIds(ids)
                      },
                      width: 40,
                      minWidth: 36,
                    }}
                    containerClassName="h-full overflow-x-auto overflow-y-auto"
                    rowClassName={(row) =>
                      selectedCaseId === row.id ? 'bg-primary/10 dark:bg-primary/20' : ''
                    }
                    enableFilters
                    onRowCountChange={(total, filtered) => {
                      setTableTotalRows(total)
                      setTableFilteredRows(filtered)
                    }}
                    onRowDoubleClick={(row) => {
                      setSelectedCaseId(row.id)
                      setDetailsOpen(true)
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {false && (
          <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 md:mt-0">
            {!selectedCase && (
              <Card className="flex flex-1 items-center justify-center">
                <CardContent>
                  <p className="text-muted-foreground text-sm">请先在左侧选择一个用户场景。</p>
                </CardContent>
              </Card>
            )}
            {selectedCase && (
              <>
                <Collapsible open={metaOpen} onOpenChange={setMetaOpen}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2">
                      <div>
                        <CardTitle>用例基本信息：{selectedCase.id}</CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">
                          来自 CSV 或说明文档的检查点描述，可在此补充更详细的说明与分组信息。
                        </p>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span>当前状态：{STATUS_LABEL[selectedCase.status]}</span>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="切换用例基本信息折叠"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </CardHeader>
                    <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
                      <CardContent className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="ls-title">标题</Label>
                            <Input
                              id="ls-title"
                              value={editingTitle != null ? editingTitle : selectedCase.title || ''}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              placeholder="请输入用例标题"
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="ls-platform-edit">平台</Label>
                            <OptionsSelect
                              id="ls-platform-edit"
                              placeholder="选择平台"
                              value={selectedCase.platform || platform || 'gettr-web'}
                              items={
                                platforms.length
                                  ? platforms
                                  : [{ value: 'gettr-web', label: 'GETTR Web' }]
                              }
                              onSelect={(item) =>
                                updateCaseMeta({
                                  platform: item.value,
                                })
                              }
                              triggerClassName="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="ls-submenu-edit">子菜单 / 角色</Label>
                            <OptionsSelectInput
                              id="ls-submenu-edit"
                              placeholder="输入或选择角色，例如 host / viewer"
                              value={
                                editingSubmenu != null
                                  ? editingSubmenu
                                  : (selectedCase.submenu as string) || ''
                              }
                              onChange={(val) => setEditingSubmenu(val)}
                              items={submenuItems}
                              inputClassName="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="ls-priority">优先级</Label>
                            <OptionsSelectInput<'P0' | 'P1' | 'P2'>
                              id="ls-priority"
                              placeholder="输入或选择优先级（P0 / P1 / P2）"
                              value={
                                editingPriority != null
                                  ? editingPriority
                                  : selectedCase.priority || ''
                              }
                              onChange={(val) => setEditingPriority(val)}
                              items={priorityItems}
                              inputClassName="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="ls-module-edit">业务模块</Label>
                            <OptionsSelectInput
                              id="ls-module-edit"
                              placeholder="输入或选择业务模块，仅限字母和数字，例如 livestream"
                              value={
                                editingModule != null
                                  ? editingModule
                                  : (selectedCase.module as string) || 'live-stream'
                              }
                              onChange={(val) =>
                                setEditingModule(val.replace(/[^A-Za-z0-9]+/g, ''))
                              }
                              items={moduleItems}
                              inputClassName="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="ls-status-edit">状态</Label>
                            <OptionsSelect<CaseStatus>
                              id="ls-status-edit"
                              placeholder="选择状态"
                              value={selectedCase.status}
                              items={statusItems}
                              onSelect={(item) =>
                                updateCaseMeta({
                                  status: item.value as CaseStatus,
                                })
                              }
                              triggerClassName="h-9"
                            />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label htmlFor="ls-desc">用例说明信息</Label>
                            <Textarea
                              id="ls-desc"
                              rows={4}
                              value={selectedCase.description || ''}
                              readOnly
                              placeholder="可在此处补充从导入数据带来的检查点描述、前置条件及业务背景。"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="ls-acceptance">验收标准（Acceptance Criteria）</Label>
                            <Textarea
                              id="ls-acceptance"
                              rows={3}
                              value={selectedCase.acceptanceCriteria || ''}
                              readOnly
                              placeholder="例如：From Studio open / Given - When - Then 等关键验收条件，将从 CSV 或说明文档导入中自动带出。"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" onClick={handleMockSaveCase}>
                            保存基本信息
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleGenerateCode}>
                            为该用例生成代码
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <Card className="flex min-h-0 flex-1 flex-col">
                  <CardHeader className="justify之间 flex flex-row items-center gap-2">
                    <div>
                      <CardTitle>步骤与检查点</CardTitle>
                      <p className="text-muted-foreground mt-1 text-xs">
                        为当前用例补充详细执行步骤，每一步包含操作、数据与期望结果。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-full"
                            onClick={handleAddPreconditionStep}
                          >
                            <ListChecks className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>添加前置步骤</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-full"
                            onClick={handleAddStep}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>添加步骤</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={handleSaveSteps}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>保存步骤</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 overflow-auto">
                    <ScenarioStepsTable
                      steps={currentSteps}
                      mode="readonly"
                      getStepParamHint={getStepParamHint}
                      onEditStep={handleEditStepInDialog}
                      onDeleteStep={handleDeleteStep}
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      {/* 用例步骤编辑侧边栏（Sheet） */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>编辑步骤与检查点</SheetTitle>
            {selectedCase && (
              <SheetDescription>
                为用例 {selectedCase.code}（{selectedCase.title}
                ）补充或调整执行步骤。
              </SheetDescription>
            )}
          </SheetHeader>
          {!selectedCase ? (
            <p className="text-muted-foreground mt-2 text-sm">请先在列表中选择一个用户场景。</p>
          ) : (
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <Card className="flex min-h-0 flex-1 flex-col border-none shadow-none">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>步骤与检查点</CardTitle>
                    <p className="text-muted-foreground mt-1 text-xs">
                      为当前用例补充详细执行步骤，每一步包含操作、数据与期望结果。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 rounded-full"
                          onClick={handleAddPreconditionStep}
                        >
                          <ListChecks className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>添加前置步骤</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 rounded-full"
                          onClick={handleAddStep}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>添加步骤</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={handleSaveSteps}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>保存步骤</TooltipContent>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 overflow-auto">
                  <ScenarioStepsTable
                    steps={currentSteps}
                    mode="editable"
                    getStepParamHint={getStepParamHint}
                    onEditStep={handleEditStepInDialog}
                    onDeleteStep={handleDeleteStep}
                    onMoveStep={handleMoveStep}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 用例基本信息编辑对话框 */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑用例基本信息</DialogTitle>
            {selectedCase && (
              <DialogDescription>
                调整用例 {selectedCase.code} 的标题、模块、角色和优先级等信息。
              </DialogDescription>
            )}
          </DialogHeader>
          {!selectedCase ? (
            <p className="text-muted-foreground text-sm">请先在列表中选择一个用户场景。</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="md-title">标题</Label>
                  <Input
                    id="md-title"
                    value={editingTitle != null ? editingTitle : selectedCase.title || ''}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    placeholder="请输入用例标题"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="md-platform">平台</Label>
                  <OptionsSelect
                    id="md-platform"
                    placeholder="选择平台"
                    value={selectedCase.platform || platform || 'gettr-web'}
                    items={
                      platforms.length ? platforms : [{ value: 'gettr-web', label: 'GETTR Web' }]
                    }
                    onSelect={(item) =>
                      updateCaseMeta({
                        platform: item.value,
                      })
                    }
                    triggerClassName="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="md-submenu">子菜单 / 角色</Label>
                  <OptionsSelectInput
                    id="md-submenu"
                    placeholder="输入或选择角色，例如 host / viewer"
                    value={
                      editingSubmenu != null
                        ? editingSubmenu
                        : (selectedCase.submenu as string) || ''
                    }
                    onChange={(val) => setEditingSubmenu(val)}
                    items={submenuItems}
                    inputClassName="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="md-priority">优先级</Label>
                  <OptionsSelectInput<'P0' | 'P1' | 'P2'>
                    id="md-priority"
                    placeholder="输入或选择优先级（P0 / P1 / P2）"
                    value={editingPriority != null ? editingPriority : selectedCase.priority || ''}
                    onChange={(val) => setEditingPriority(val)}
                    items={priorityItems}
                    inputClassName="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="md-module">业务模块</Label>
                  <OptionsSelectInput
                    id="md-module"
                    placeholder="输入或选择业务模块，仅限字母和数字，例如 livestream"
                    value={
                      editingModule != null
                        ? editingModule
                        : (selectedCase.module as string) || 'live-stream'
                    }
                    onChange={(val) => setEditingModule(val.replace(/[^A-Za-z0-9]+/g, ''))}
                    items={moduleItems}
                    inputClassName="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="md-status">状态</Label>
                  <OptionsSelect<CaseStatus>
                    id="md-status"
                    placeholder="选择状态"
                    value={selectedCase.status}
                    items={statusItems}
                    onSelect={(item) =>
                      updateCaseMeta({
                        status: item.value as CaseStatus,
                      })
                    }
                    triggerClassName="h-9"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setMetaDialogOpen(false)}>
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    await handleMockSaveCase()
                    setMetaDialogOpen(false)
                  }}
                >
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 生成代码：选择环境模板对话框 */}
      <Dialog open={envDialogOpen} onOpenChange={setEnvDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(e) => {
            if (envDialogLoading) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (envDialogLoading) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (envDialogLoading) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>选择环境模板生成代码</DialogTitle>
            <DialogDescription>
              为当前用例选择一套预定义的运行环境配置（useTestCase 参数）。如不选择，将使用默认占位配置。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              当前平台：{envDialogPlatform} · 驱动：
              {envDialogDriver === 'android'
                ? 'Android'
                : envDialogDriver === 'browser'
                ? 'Browser'
                : envDialogDriver}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">环境模板</Label>
              <OptionsSelect<string>
                value={
                  envDialogSelectedId == null
                    ? 'none'
                    : envDialogSelectedId === 'none'
                    ? 'none'
                    : String(envDialogSelectedId)
                }
                items={[
                  {
                    value: 'none',
                    label: '不使用模板（使用默认配置）',
                  },
                  ...envDialogTemplates.map((tpl) => ({
                    value: String(tpl.id),
                    label: `${tpl.name} (${tpl.key})`,
                  })),
                ]}
                onSelect={(item) => {
                  if (item.value === 'none') {
                    setEnvDialogSelectedId('none')
                  } else {
                    const n = Number(item.value)
                    setEnvDialogSelectedId(Number.isFinite(n) ? n : null)
                  }
                }}
                disabled={envDialogLoading}
                triggerClassName="h-9 text-xs"
              />
              {envDialogTemplates.length === 0 && !envDialogLoading && (
                <p className="text-[11px] text-muted-foreground">
                  当前平台尚未配置环境模板，将使用默认占位配置。
                </p>
              )}
              <button
                type="button"
                className="mt-1 text-[11px] text-blue-600 hover:underline"
                onClick={() => {
                  if (envDialogLoading) return
                  setEnvDialogOpen(false)
                  router.push('/settings/env-templates')
                }}
              >
                在「环境模板管理」中配置更多模板…
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={envDialogLoading}
              onClick={() => {
                if (envDialogLoading) return
                setEnvDialogOpen(false)
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={envDialogLoading || !envDialogCaseId}
              onClick={async () => {
                if (!envDialogCaseId) return
                const tplId =
                  envDialogSelectedId && envDialogSelectedId !== 'none'
                    ? Number(envDialogSelectedId)
                    : null
                setEnvDialogLoading(true)
                try {
                  if (tplId != null) {
                    try {
                      const key = getEnvTemplateStorageKey(envDialogPlatform, envDialogDriver)
                      localStorage.setItem(key, String(tplId))
                    } catch {
                      // ignore
                    }
                  }
                  await generateCodeForCase(envDialogCaseId, tplId)
                  setEnvDialogOpen(false)
                } finally {
                  setEnvDialogLoading(false)
                }
              }}
            >
              生成代码
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* “添加步骤”对话框：页面 + 动作 + 参数 */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent
          className="sm:max-w-lg"
          onEscapeKeyDown={(e) => {
            if (loadingCatalog) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (loadingCatalog) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (loadingCatalog) e.preventDefault()
          }}
        >
          <div className="max-h-[75vh] overflow-y-auto rounded-lg border-1 px-4 py-3">
            <DialogHeader>
              <DialogTitle>
                {(() => {
                  const plat = (selectedCase?.platform || platform || '').toString().toLowerCase()
                  const isApiPlatform = plat.includes('-api-')
                  if (isApiPlatform) {
                    const base = editingStepIdForDialog != null ? '编辑步骤（API）' : '添加步骤（API）'
                    return base
                  }
                  const page =
                    (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null
                  const action = page?.actions.find((a) => a.key === stepDialogActionKey) || null
                  const base = editingStepIdForDialog != null ? '编辑步骤' : '添加步骤'
                  if (!action) {
                    return `${base}：选择页面与动作`
                  }
                  const typeLabel = action.kind === 'assert' ? '检查点' : '操作'
                  return `${base}（${typeLabel}）`
                })()}
              </DialogTitle>
              <DialogDescription>
                {(() => {
                  const plat = (selectedCase?.platform || platform || '').toString().toLowerCase()
                  const isApiPlatform = plat.includes('-api-')
                  if (isApiPlatform) {
                    return '直接编辑步骤说明与期望结果，适用于基于 API 的用户场景（不绑定页面动作）。'
                  }
                  return '通过下拉选择页面和动作，自动与 gettr-web-lib 中的 Page 类和方法建立映射，再补充参数与期望检查点。'
                })()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>操作说明</Label>
              <Textarea
                rows={2}
                value={stepDialogActionText}
                onChange={(e) => setStepDialogActionText(e.target.value)}
                placeholder={(() => {
                  const plat = (selectedCase?.platform || platform || '')
                    .toString()
                    .toLowerCase()
                  const isApiPlatform = plat.includes('-api-')
                  if (isApiPlatform) {
                    return '例如：调用 /u/live/stream 接口，校验返回流对象信息。'
                  }
                  const page =
                    (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null
                  const action = page?.actions.find((a) => a.key === stepDialogActionKey) || null
                  if (page && action) return `${page.label} · ${action.label}`
                  return '可选：补充对该步骤的人类可读说明'
                })()}
              />
            </div>
            {(() => {
              const plat = (selectedCase?.platform || platform || '')
                .toString()
                .toLowerCase()
              const isApiPlatform = plat.includes('-api-')
              if (!isApiPlatform) return null
              return (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="api-step-method">HTTP 方法</Label>
                      <OptionsSelect<string>
                        id="api-step-method"
                        value={stepDialogApiMethod}
                        items={[
                          { value: 'GET', label: 'GET' },
                          { value: 'POST', label: 'POST' },
                          { value: 'PUT', label: 'PUT' },
                          { value: 'DELETE', label: 'DELETE' },
                          { value: 'PATCH', label: 'PATCH' },
                        ]}
                        placeholder="选择方法"
                        onSelect={(item) =>
                          setStepDialogApiMethod(
                            (item.value || 'GET').toString().toUpperCase() || 'GET'
                          )
                        }
                        triggerClassName="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="api-step-path">请求路径</Label>
                      <Input
                        id="api-step-path"
                        value={stepDialogApiPath}
                        onChange={(e) => setStepDialogApiPath(e.target.value)}
                        placeholder="/u/live/stream"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="api-step-body">请求 Body（JSON，可选）</Label>
                    <Textarea
                      id="api-step-body"
                      rows={3}
                      value={stepDialogApiBody}
                      onChange={(e) => setStepDialogApiBody(e.target.value)}
                      placeholder='例如：{"streamIds":["lv_p_cbx_live_1s"]}'
                    />
                  </div>
                </>
              )
            })()}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ls-step-page">页面</Label>
                <OptionsSelectSearch
                  id="ls-step-page"
                  placeholder="选择页面"
                  value={stepDialogPageKey}
                  items={(actionCatalog?.pages || []).map((p) => ({
                    value: p.key,
                    label: p.label,
                  }))}
                  onChange={(val) => {
                    setStepDialogPageKey(val)
                    setStepDialogActionKey(undefined)
                    setStepDialogArgs({})
                  }}
                  inputClassName="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ls-step-action">动作</Label>
                <OptionsSelectSearch
                  id="ls-step-action"
                  placeholder="选择动作"
                  value={stepDialogActionKey}
                  items={
                    (actionCatalog?.pages || [])
                      .find((p) => p.key === stepDialogPageKey)
                      ?.actions.map((a) => ({
                        value: a.key,
                        label: a.label,
                      })) || []
                  }
                  onChange={(val) => {
                    setStepDialogActionKey(val)
                    setStepDialogArgs({})
                    const page =
                      (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null
                    const action = page?.actions.find((a) => a.key === val) || null
                    if (action?.defaultExpected && !stepDialogExpected) {
                      setStepDialogExpected(action.defaultExpected)
                    }
                    if (!stepDialogCheckType && action && action.kind === 'assert') {
                      const locRaw = (action as any).locator as string | null | undefined
                      if (locRaw && locRaw.trim()) {
                        setStepDialogCheckType('element-visible')
                        setStepDialogCheckLocator(locRaw.trim())
                      }
                    }
                  }}
                  inputClassName="h-9"
                />
              </div>
            </div>

            <div className="space-y-3">
              {(() => {
                const page =
                  (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null
                const action = page?.actions.find((a) => a.key === stepDialogActionKey) || null
                const params = action?.params || []
                if (!params.length) return null
                return (
                  <div className="space-y-2">
                    <Label className="text-xs">动作参数</Label>
                    <div className="space-y-2">
                      {params.map((param) => (
                        <div key={param.name} className="space-y-1">
                          <Label className="flex items-center justify-between text-xs">
                            <span>{param.name}</span>
                            {param.required && (
                              <span className="text-[11px] text-red-500">必填</span>
                            )}
                          </Label>
                          <Input
                            value={stepDialogArgs[param.name] || ''}
                            onChange={(e) =>
                              setStepDialogArgs((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            placeholder={param.placeholder || ''}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {(() => {
                const page =
                  (actionCatalog?.pages || []).find((p) => p.key === stepDialogPageKey) || null
                const action = page?.actions.find((a) => a.key === stepDialogActionKey) || null
                const callSteps = (action as any)?.callSteps as
                  | { targetActionKey: string; args?: string[]; sortOrder?: number }[]
                  | undefined
                if (!page || !action || action.kind !== 'call' || !callSteps || !callSteps.length) {
                  return null
                }
                const stepsSorted = [...callSteps].sort((a, b) => {
                  const sa =
                    typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder)
                      ? a.sortOrder
                      : 0
                  const sb =
                    typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder)
                      ? b.sortOrder
                      : 0
                  return sa - sb
                })
                return (
                  <div className="space-y-2 rounded-md border px-2 py-2">
                    <Label className="text-xs">内部调用预览（函数调用）</Label>
                    <p className="text-[11px] text-muted-foreground">
                      该动作为函数调用类型，将在 Page 类中生成一个组合方法，内部依次调用当前页面上的其它方法。
                    </p>
                    <div className="space-y-1">
                      {stepsSorted.map((step, idx) => {
                        const target =
                          page.actions.find((a) => a.key === step.targetActionKey) || null
                        const targetLabel = target
                          ? `${target.method || target.key} · ${target.label || target.key}`
                          : step.targetActionKey
                        const argList = (step.args || [])
                          .map((v) => String(v || '').trim())
                          .filter((v) => v.length > 0)
                        const argPreview =
                          argList.length > 0 ? argList.join(', ') : '（无参数或不传）'
                        return (
                          <div
                            key={`${step.targetActionKey}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted px-2 py-1.5 text-[11px]"
                          >
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="font-mono text-[11px]">
                                步骤 {idx + 1}:{' '}
                                <span className="font-normal">
                                  {page.varName || 'page'}.{target ? target.method : step.targetActionKey}
                                  ({argPreview})
                                </span>
                              </span>
                              {target && (
                                <span className="text-muted-foreground truncate">
                                  {target.label}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-2">
                <Label className="text-xs">自动检查规则（可选）</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-type" className="text-[11px]">
                      检查类型
                    </Label>
                    <OptionsSelect<string>
                      id="ls-step-check-type"
                      value={stepDialogCheckType || 'none'}
                      items={[
                        { value: 'none', label: '不配置（仅写期望文案）' },
                        { value: 'element-visible', label: '元素出现（element visible）' },
                        { value: 'element-hidden', label: '元素消失（element hidden）' },
                        { value: 'url-contains', label: '页面 URL 包含（url contains）' },
                        { value: 'url-equals', label: '页面 URL 等于（url equals）' },
                      ]}
                      onSelect={(item) => {
                        const v = item.value
                        if (
                          v === 'element-visible' ||
                          v === 'element-hidden' ||
                          v === 'url-contains' ||
                          v === 'url-equals'
                        ) {
                          setStepDialogCheckType(v)
                        } else {
                          setStepDialogCheckType('')
                        }
                      }}
                      triggerClassName="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-timeout" className="text-[11px]">
                      超时时间（毫秒，可选）
                    </Label>
                    <Input
                      id="ls-step-check-timeout"
                      className="h-8 text-xs"
                      value={stepDialogCheckTimeoutMs}
                      onChange={(e) => setStepDialogCheckTimeoutMs(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="例如：30000"
                    />
                  </div>
                </div>
                {stepDialogCheckType === 'element-visible' ||
                stepDialogCheckType === 'element-hidden' ? (
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-locator" className="text-[11px]">
                      元素定位字符串（CSS/XPath/资源 ID）
                    </Label>
                    <Input
                      id="ls-step-check-locator"
                      className="h-8 text-xs"
                      value={stepDialogCheckLocator}
                      onChange={(e) => setStepDialogCheckLocator(e.target.value)}
                      placeholder='例如：div.action-bar > button，或 android=new UiSelector().resourceId("com.xx:id/btn")'
                    />
                  </div>
                ) : null}
                {stepDialogCheckType === 'url-contains' ||
                stepDialogCheckType === 'url-equals' ? (
                  <div className="space-y-1">
                    <Label htmlFor="ls-step-check-url" className="text-[11px]">
                      期望 URL
                    </Label>
                    <Input
                      id="ls-step-check-url"
                      className="h-8 text-xs"
                      value={stepDialogCheckExpectedUrl}
                      onChange={(e) => setStepDialogCheckExpectedUrl(e.target.value)}
                      placeholder="例如：/live 或 https://stg.gettr.com/live"
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="ls-step-expected">提示信息（可选）</Label>
                <Textarea
                  id="ls-step-expected"
                  rows={3}
                  value={stepDialogExpected}
                  onChange={(e) => setStepDialogExpected(e.target.value)}
                  placeholder="当检查失败时打印的提示，例如：在 30 秒内进入“直播中”状态，观众端可以看到直播画面。"
                />
              </div>
            </div>
            </div>
            <DialogFooter className="mt-3">
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  取消
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={() => {
                  if (!selectedCase) {
                    toast.error('请先在左侧选择一个用例')
                    return
                  }
                  const plat = (selectedCase.platform || platform || '')
                    .toString()
                    .toLowerCase()
                  const isApiPlatform = plat.includes('-api-')

                  if (isApiPlatform) {
                    const caseId = selectedCase.id
                    const list = stepsByCase[caseId] || []
                    const method =
                      (stepDialogApiMethod || 'GET').toString().trim().toUpperCase() || 'GET'
                    const pathVal = (stepDialogApiPath || '').toString().trim()
                    const bodyVal = (stepDialogApiBody || '').toString().trim()
                    const parts: string[] = []
                    if (method) parts.push(`method=${method}`)
                    if (pathVal) parts.push(`path=${pathVal}`)
                    if (bodyVal) parts.push(`body=${bodyVal}`)
                    const dataText = parts.join(', ')
                    const actionText = (stepDialogActionText || '').trim() || 'API 调用'
                    const expectedText = (stepDialogExpected || '').trim() || '（待补充）'

                    setStepsByCase((prev) => {
                      const currentList = prev[caseId] || []

                      if (editingStepIdForDialog) {
                        const targetId = editingStepIdForDialog
                        const updated = currentList.map((s) =>
                          s.id === targetId
                            ? {
                                ...s,
                                action: actionText,
                                data: dataText,
                                expected: expectedText,
                              }
                            : s
                        )
                        return { ...prev, [caseId]: updated }
                      }

                      const baseOrder =
                        stepDialogOrder && Number.isFinite(stepDialogOrder)
                          ? stepDialogOrder
                          : currentList.length > 0
                          ? Math.max(...currentList.map((s) => s.order)) + 1
                          : 1

                      const newStep: UserScenarioStep = {
                        id: `${caseId}-${Date.now()}`,
                        order: baseOrder,
                        action: actionText,
                        data: dataText,
                        expected: expectedText,
                      }
                      return { ...prev, [caseId]: [...currentList, newStep] }
                    })
                    setEditingStepIdForDialog(null)
                    setStepDialogOpen(false)
                    return
                  }

                  const catalog = actionCatalog
                  if (!catalog) {
                    toast.error('页面动作目录尚未加载')
                    return
                  }
                  const page =
                    catalog.pages.find((p) => p.key === stepDialogPageKey) ||
                    catalog.pages[0] ||
                    null
                  if (!page) {
                    toast.error('请先选择页面')
                    return
                  }
                  const action =
                    page.actions.find((a) => a.key === stepDialogActionKey) || null
                  if (!action) {
                    toast.error('请先选择动作')
                    return
                  }
                  const params = action.params || []
                  for (const param of params) {
                    if (param.required && !stepDialogArgs[param.name]) {
                      toast.error(`请输入参数：${param.name}`)
                      return
                    }
                  }
                  let checkRule: StepCheckRule | undefined
                  if (stepDialogCheckType) {
                    if (
                      stepDialogCheckType === 'element-visible' ||
                      stepDialogCheckType === 'element-hidden'
                    ) {
                      const rawLocator =
                        stepDialogCheckLocator.trim() ||
                        ((action as any).locator
                          ? String((action as any).locator).trim()
                          : '')
                      if (!rawLocator) {
                        toast.error('请选择“元素出现/消失”时需补充元素定位字符串')
                        return
                      }
                      const timeoutNum = Number(stepDialogCheckTimeoutMs || '')
                      checkRule = {
                        type: stepDialogCheckType,
                        locator: rawLocator,
                        timeoutMs:
                          Number.isFinite(timeoutNum) && timeoutNum > 0
                            ? Math.floor(timeoutNum)
                            : undefined,
                      }
                    } else if (
                      stepDialogCheckType === 'url-contains' ||
                      stepDialogCheckType === 'url-equals'
                    ) {
                      const rawUrl = stepDialogCheckExpectedUrl.trim()
                      if (!rawUrl) {
                        toast.error('请选择“URL 检查”时需补充期望 URL')
                        return
                      }
                      const timeoutNum = Number(stepDialogCheckTimeoutMs || '')
                      checkRule = {
                        type: stepDialogCheckType,
                        expectedUrl: rawUrl,
                        timeoutMs:
                          Number.isFinite(timeoutNum) && timeoutNum > 0
                            ? Math.floor(timeoutNum)
                            : undefined,
                      }
                    }
                  }
                  const binding: StepBindingV1 = {
                    ver: 1,
                    platform: catalog.platform,
                    pageKey: page.key,
                    actionKey: action.key,
                    args: params.map((p) => ({
                      name: p.name,
                      value: stepDialogArgs[p.name] || '',
                    })),
                    ...(checkRule ? { checkRule } : {}),
                  }
                  const defaultActionText = `${page.label} · ${action.label}`
                  const actionText =
                    (stepDialogActionText || '').trim() || defaultActionText
                  const dataText =
                    params.length > 0
                      ? params
                          .map((p) => `${p.name}=${stepDialogArgs[p.name] || ''}`)
                          .join(', ')
                      : ''
                  const expectedText =
                    stepDialogExpected || action.defaultExpected || '（待补充）'

                  setStepsByCase((prev) => {
                    const caseId = selectedCase.id
                    const list = prev[caseId] || []

                    if (editingStepIdForDialog) {
                      const targetId = editingStepIdForDialog
                      const updated = list.map((s) =>
                        s.id === targetId
                          ? {
                              ...s,
                              action: actionText,
                              data: dataText,
                              expected: expectedText,
                              binding: JSON.stringify(binding),
                            }
                          : s
                      )
                      return { ...prev, [caseId]: updated }
                    }

                    const baseOrder =
                      list.length > 0 ? Math.max(...list.map((s) => s.order)) + 1 : 1
                    const newStep: UserScenarioStep = {
                      id: `${caseId}-${Date.now()}`,
                      order: baseOrder,
                      action: actionText,
                      data: dataText,
                      expected: expectedText,
                      binding: JSON.stringify(binding),
                    }
                    return { ...prev, [caseId]: [...list, newStep] }
                  })
                  setEditingStepIdForDialog(null)
                  setStepDialogOpen(false)
                }}
              >
                确定
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 新增用户场景对话框 */}
      <Dialog open={newCaseOpen} onOpenChange={setNewCaseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增用户场景</DialogTitle>
            <DialogDescription>
              填写基本信息和验收标准，创建一条新的用户场景。编号应保持唯一，例如 LS001 /
              US-0-host-1。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="nc-platform">平台</Label>
                <OptionsSelect
                  id="nc-platform"
                  value={platform}
                  items={
                    platforms.length ? platforms : [{ value: 'gettr-web', label: 'GETTR Web' }]
                  }
                  placeholder="选择平台"
                  onSelect={(item) => {
                    setPlatform(item.value)
                    try {
                      localStorage.setItem('gtt:scenarios:platform', item.value)
                    } catch {}
                  }}
                  triggerClassName="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-code">用例编号</Label>
                <Input
                  id="nc-code"
                  value={newCaseCode}
                  onChange={(e) => setNewCaseCode(e.target.value)}
                  placeholder="例如：LS001 或 US-0-host-1"
                  className="h-9"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="nc-title">标题</Label>
                <Input
                  id="nc-title"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="简要描述该用户场景，例如：主播从 Studio 发起直播"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-feature">模块 / Feature</Label>
                <Input
                  id="nc-feature"
                  value={newCaseFeature}
                  onChange={(e) => setNewCaseFeature(e.target.value)}
                  placeholder="例如：Live Stream / Login"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-submenu">子菜单 / Persona</Label>
                <OptionsSelect
                  id="nc-submenu"
                  value={newCaseSubmenu}
                  items={submenuItems}
                  placeholder="选择子菜单"
                  onSelect={(item) => setNewCaseSubmenu(item.value)}
                  triggerClassName="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-priority">优先级</Label>
                <OptionsSelect<'P0' | 'P1' | 'P2'>
                  id="nc-priority"
                  value={newCasePriority}
                  items={priorityItems}
                  placeholder="选择优先级"
                  onSelect={(item) => setNewCasePriority(item.value)}
                  triggerClassName="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-status">状态</Label>
                <OptionsSelect<CaseStatus>
                  id="nc-status"
                  value={newCaseStatus}
                  items={statusItems}
                  placeholder="选择状态"
                  onSelect={(item) => setNewCaseStatus(item.value as CaseStatus)}
                  triggerClassName="h-9"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nc-desc">用例说明信息</Label>
                <Textarea
                  id="nc-desc"
                  rows={3}
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  placeholder="可在此处补充从业务角度对该用户场景的说明、前置条件等。"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nc-acceptance">验收标准（Acceptance Criteria）</Label>
                <Textarea
                  id="nc-acceptance"
                  rows={3}
                  value={newCaseAcceptance}
                  onChange={(e) => setNewCaseAcceptance(e.target.value)}
                  placeholder="例如：Given-When-Then 形式的关键验收条件。"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={newCaseSubmitting}>
                取消
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleCreateCase} disabled={newCaseSubmitting}>
              {newCaseSubmitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 说明文档导入前的 AI 提示配置对话框 */}
      <Dialog open={docAiPromptOpen} onOpenChange={setDocAiPromptOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>说明文档解析提示（可选）</DialogTitle>
            <DialogDescription>
              在上传说明文档/设计文档前，可在此补充给 AI 的解析说明，例如重点字段、命名规则或拆分粒度。不填写时将使用默认规则。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="doc-ai-hint">给 AI 的补充说明</Label>
            <Textarea
              id="doc-ai-hint"
              rows={6}
              value={docAiPromptText}
              onChange={(e) => setDocAiPromptText(e.target.value)}
              placeholder="例如：请优先复用文档中的用例编号作为 caseCode；没有编号时按模块 + 序号生成稳定 ID；测试步骤与预期结果使用 1./2. 的编号形式。"
            />
            <p className="text-muted-foreground mt-1 text-[11px]">
              提示仅影响本次上传，后续可在此调整；系统仍会自动应用 Livestream CSV 模板相关的默认规则。
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('gtt:scenarios:docAiHint', docAiPromptText || '')
                } catch {
                  // ignore
                }
                setDocAiPromptOpen(false)
                const input = document.getElementById('ls-upload-doc') as HTMLInputElement | null
                input?.click()
              }}
            >
              确定并选择文档
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
