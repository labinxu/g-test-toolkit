'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '@/app/context/session-context'
import { Button } from '@/components/ui/button'
import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TagsInput } from '@/components/ui/tags-input'
import { toast } from 'sonner'

type TestRef = {
  testId: string
  name: string
  suitePath: string[]
  module?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

function parseKeys(input: string): string[] {
  return Array.from(
    new Set(
      (input || '')
        .split(/[,;\n\r\t\s]+/g)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
}

export default function TraceabilityPage() {
  const { user: sessionUser } = useSession()
  const [user, setUser] = useState('')
  const [users, setUsers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [tests, setTests] = useState<TestRef[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [reqInput, setReqInput] = useState('')
  const [countCombined, setCountCombined] = useState(0)
  const [countStatic, setCountStatic] = useState(0)
  const [countExecuted, setCountExecuted] = useState(0)
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const [suggestBanner, setSuggestBanner] = useState<null | {
    mappings: number
    requirements: number
  }>(null)
  const [mappings, setMappings] = useState<
    Array<{
      id?: number
      requirementKey: string
      testId: string
      linkType?: string
      note?: string
    }>
  >([])
  const [requirements, setRequirements] = useState<
    Array<{ key: string; system?: string; title?: string }>
  >([])
  const [reqFilter, setReqFilter] = useState('')
  const [testFilter, setTestFilter] = useState('')
  const [selectedMapIds, setSelectedMapIds] = useState<Set<number>>(new Set())
  const filteredMappings = useMemo(() => {
    return mappings
      .filter((m) => !reqFilter || m.requirementKey.toLowerCase().includes(reqFilter.toLowerCase()))
      .filter((m) => !testFilter || m.testId.toLowerCase().includes(testFilter.toLowerCase()))
  }, [mappings, reqFilter, testFilter])
  const [groupByReq, setGroupByReq] = useState(false)
  const [openTests, setOpenTests] = useState(true)
  const [openMappingsCard, setOpenMappingsCard] = useState(true)
  // Persist collapsible states (per user)
  useEffect(() => {
    const prefix = `traceability:section:`
    const userKey = sessionUser?.username || 'default'
    try {
      const t = localStorage.getItem(`${prefix}tests:${userKey}`)
      if (t != null) setOpenTests(t === '1')
      const m = localStorage.getItem(`${prefix}mappings:${userKey}`)
      if (m != null) setOpenMappingsCard(m === '1')
    } catch {}
  }, [sessionUser?.username])
  useEffect(() => {
    const prefix = `traceability:section:`
    const userKey = sessionUser?.username || 'default'
    try {
      localStorage.setItem(`${prefix}tests:${userKey}`, openTests ? '1' : '0')
    } catch {}
  }, [openTests, sessionUser?.username])
  useEffect(() => {
    const prefix = `traceability:section:`
    const userKey = sessionUser?.username || 'default'
    try {
      localStorage.setItem(`${prefix}mappings:${userKey}`, openMappingsCard ? '1' : '0')
    } catch {}
  }, [openMappingsCard, sessionUser?.username])
  // Export options
  const [xrLabels, setXrLabels] = useState('')
  const [trSection, setTrSection] = useState('')
  const [trUseFirstSuite, setTrUseFirstSuite] = useState(true)
  const [trTemplate, setTrTemplate] = useState('Test Case')
  const [trType, setTrType] = useState('Functional')
  const [trPriority, setTrPriority] = useState('Medium')
  const [trSectionOptions, setTrSectionOptions] = useState<string[]>(['Root'])
  const trTemplateOptions = ['Test Case', 'Exploratory Session']
  const trTypeOptions = [
    'Functional',
    'Regression',
    'Smoke',
    'Performance',
    'Security',
    'Usability',
    'Compatibility',
    'Acceptance',
  ]
  const trPriorityOptions = ['Critical', 'High', 'Medium', 'Low']
  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected])
  // Test list filters
  const [testQuery, setTestQuery] = useState('')
  const [suiteQuery, setSuiteQuery] = useState('')
  const [moduleQuery, setModuleQuery] = useState('')
  const [onlyMapped, setOnlyMapped] = useState(false)
  const [onlyUnmapped, setOnlyUnmapped] = useState(false)
  const mappedSet = useMemo(() => new Set(mappings.map((m) => m.testId)), [mappings])
  const filteredTests = useMemo(() => {
    const tq = testQuery.toLowerCase()
    const sq = suiteQuery.toLowerCase()
    const mq = moduleQuery.toLowerCase()
    return tests.filter((t) => {
      if (tq && !(t.name.toLowerCase().includes(tq) || t.testId.toLowerCase().includes(tq)))
        return false
      if (sq && !t.suitePath.join(' › ').toLowerCase().includes(sq)) return false
      if (mq && !(t.module || '').toLowerCase().includes(mq)) return false
      if (onlyMapped && !mappedSet.has(t.testId)) return false
      if (onlyUnmapped && mappedSet.has(t.testId)) return false
      return true
    })
  }, [tests, testQuery, suiteQuery, moduleQuery, onlyMapped, onlyUnmapped, mappedSet])

  const fetchTests = async () => {
    setLoading(true)
    try {
      const [resCombined, resStatic, resExecuted] = await Promise.all([
        fetch(`${API_BASE}/traceability/tests?user=${encodeURIComponent(user)}`),
        fetch(`${API_BASE}/traceability/tests-static?user=${encodeURIComponent(user)}`),
        fetch(`${API_BASE}/traceability/tests-executed?user=${encodeURIComponent(user)}`),
      ])
      const [dataCombined, dataStatic, dataExecuted] = await Promise.all([
        resCombined.json(),
        resStatic.json(),
        resExecuted.json(),
      ])
      const list: TestRef[] = Array.isArray(dataCombined) ? dataCombined : []
      setTests(list)
      setCountCombined(Array.isArray(list) ? list.length : 0)
      setCountStatic(Array.isArray(dataStatic) ? dataStatic.length : 0)
      setCountExecuted(Array.isArray(dataExecuted) ? dataExecuted.length : 0)
      setSelected({})
      // scroll list area to top after loading new dataset
      requestAnimationFrame(() => {
        try {
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
          }
        } catch {}
      })
      // Build Section options from unique first-level suite names
      try {
        const firstLevels = Array.from(
          new Set(list.map((t) => t.suitePath?.[0]).filter(Boolean))
        ) as string[]
        const opts = ['Root', ...firstLevels]
        setTrSectionOptions(opts.length ? opts : ['Root'])
        if (!trUseFirstSuite) {
          if (!opts.includes(trSection)) setTrSection(opts[0] || 'Root')
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  const loadMappings = async () => {
    try {
      const [resMaps, resReqs] = await Promise.all([
        fetch(`${API_BASE}/traceability/mappings`, { cache: 'no-store' }),
        fetch(`${API_BASE}/traceability/requirements`, { cache: 'no-store' }),
      ])
      const [maps, reqs] = await Promise.all([resMaps.json(), resReqs.json()])
      setMappings(Array.isArray(maps) ? maps : [])
      setSelectedMapIds(new Set())
      setRequirements(Array.isArray(reqs) ? reqs : [])
    } catch {}
  }

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/traceability/users`, {
        cache: 'no-store',
        credentials: 'include' as RequestCredentials,
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setUsers(data)
        const preferred =
          sessionUser?.username && data.includes(sessionUser.username) ? sessionUser.username : ''
        if (!user) setUser(preferred || data[0] || '')
      }
    } catch {}
  }

  useEffect(() => {
    if (sessionUser?.username && !user) setUser(sessionUser.username)
  }, [sessionUser?.username])

  useEffect(() => {
    if (sessionUser?.isAdmin) loadUsers()
  }, [sessionUser?.isAdmin])

  useEffect(() => {
    if (user) {
      fetchTests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    loadMappings()
  }, [])

  // Persist export config per-user in localStorage
  useEffect(() => {
    const key = `traceabilityExportConfig:${sessionUser?.username || 'default'}`
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const cfg = JSON.parse(saved)
        if (cfg?.tr) {
          if (typeof cfg.tr.section === 'string') setTrSection(cfg.tr.section)
          if (typeof cfg.tr.useFirstSuite === 'boolean') setTrUseFirstSuite(cfg.tr.useFirstSuite)
          if (typeof cfg.tr.template === 'string') setTrTemplate(cfg.tr.template)
          if (typeof cfg.tr.type === 'string') setTrType(cfg.tr.type)
          if (typeof cfg.tr.priority === 'string') setTrPriority(cfg.tr.priority)
        }
        if (typeof cfg?.xr?.labels === 'string') setXrLabels(cfg.xr.labels)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.username])

  useEffect(() => {
    const key = `traceabilityExportConfig:${sessionUser?.username || 'default'}`
    try {
      const cfg = {
        tr: {
          section: trSection,
          useFirstSuite: trUseFirstSuite,
          template: trTemplate,
          type: trType,
          priority: trPriority,
        },
        xr: { labels: xrLabels },
      }
      localStorage.setItem(key, JSON.stringify(cfg))
    } catch {}
  }, [trSection, trUseFirstSuite, trTemplate, trType, trPriority, xrLabels, sessionUser?.username])

  // Load export config from server (per-user)
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/traceability/export-config`, {
          credentials: 'include' as RequestCredentials,
        })
        if (!res.ok) return
        const cfg = await res.json()
        if (cfg?.tr) {
          if (typeof cfg.tr.section === 'string') setTrSection(cfg.tr.section)
          if (typeof cfg.tr.useFirstSuite === 'boolean') setTrUseFirstSuite(cfg.tr.useFirstSuite)
          if (typeof cfg.tr.template === 'string') setTrTemplate(cfg.tr.template)
          if (typeof cfg.tr.type === 'string') setTrType(cfg.tr.type)
          if (typeof cfg.tr.priority === 'string') setTrPriority(cfg.tr.priority)
        }
        if (typeof cfg?.xr?.labels === 'string') setXrLabels(cfg.xr.labels)
      } catch {}
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.username])

  // Save export config to server when changed
  useEffect(() => {
    const run = async () => {
      try {
        const payload = {
          tr: {
            section: trSection,
            useFirstSuite: trUseFirstSuite,
            template: trTemplate,
            type: trType,
            priority: trPriority,
          },
          xr: { labels: xrLabels },
        }
        await fetch(`${API_BASE}/traceability/export-config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include' as RequestCredentials,
          body: JSON.stringify(payload),
        })
      } catch {}
    }
    run()
  }, [trSection, trUseFirstSuite, trTemplate, trType, trPriority, xrLabels])

  const upsertRequirements = async () => {
    const keys = parseKeys(reqInput)
    if (!keys.length) return alert('请输入至少一个需求 Key')
    const items = keys.map((k) => ({ key: k, system: 'jira' }))
    const res = await fetch(`${API_BASE}/traceability/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) return alert('保存需求失败')
    alert('需求已保存/更新')
  }

  const createMappings = async () => {
    const keys = parseKeys(reqInput)
    if (!keys.length) return alert('请输入至少一个需求 Key')
    const selectedTests = tests.filter((t) => selected[t.testId])
    if (!selectedTests.length) return alert('请选择至少一个测试')
    const mappings: Array<{ requirementKey: string; testId: string }> = []
    for (const t of selectedTests)
      for (const k of keys) mappings.push({ requirementKey: k, testId: t.testId })
    const res = await fetch(`${API_BASE}/traceability/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings }),
    })
    if (!res.ok) return alert('保存映射失败')
    alert('映射已保存')
  }

  const exportTestrail = async () => {
    const res = await fetch(`${API_BASE}/traceability/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'testrail-cases',
        user,
        testrail: {
          section: trSection || undefined,
          useFirstSuite: trUseFirstSuite,
          template: trTemplate || undefined,
          type: trType || undefined,
          priority: trPriority || undefined,
        },
      }),
    })
    if (!res.ok) return alert('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'testrail-cases.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportXray = async () => {
    const projectKey = window.prompt('请输入 Jira 项目 Key（如 PROJ）用于 Xray 导入：', '') || ''
    const res = await fetch(`${API_BASE}/traceability/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'xray',
        user,
        projectKey,
        labels: xrLabels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    })
    if (!res.ok) return alert('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'xray-import.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportFilteredTestrail = async () => {
    if (!filteredMappings.length) return toast.message('当前筛选为空')
    const requirementKeys = Array.from(new Set(filteredMappings.map((m) => m.requirementKey)))
    const testIds = Array.from(new Set(filteredMappings.map((m) => m.testId)))
    const res = await fetch(`${API_BASE}/traceability/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'testrail-cases',
        user,
        requirementKeys,
        testIds,
        testrail: {
          section: trSection || undefined,
          useFirstSuite: trUseFirstSuite,
          template: trTemplate || undefined,
          type: trType || undefined,
          priority: trPriority || undefined,
        },
      }),
    })
    if (!res.ok) return toast.error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'testrail-cases.filtered.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportFilteredXray = async () => {
    if (!filteredMappings.length) return toast.message('当前筛选为空')
    const projectKey = window.prompt('请输入 Jira 项目 Key（如 PROJ）用于 Xray 导入：', '') || ''
    const requirementKeys = Array.from(new Set(filteredMappings.map((m) => m.requirementKey)))
    const testIds = Array.from(new Set(filteredMappings.map((m) => m.testId)))
    const res = await fetch(`${API_BASE}/traceability/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: 'xray',
        user,
        projectKey,
        requirementKeys,
        testIds,
        labels: xrLabels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    })
    if (!res.ok) return toast.error('导出失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'xray-import.filtered.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const fetchSuggestions = async () => {
    try {
      const res = await fetch(`${API_BASE}/traceability/suggest?user=${encodeURIComponent(user)}`)
      if (!res.ok) throw new Error('获取建议失败')
      const data = await res.json()
      const mappings = Array.isArray(data?.mappings) ? data.mappings.length : 0
      const requirements = Array.isArray(data?.requirements) ? data.requirements.length : 0
      setSuggestBanner({ mappings, requirements })
      if (mappings === 0 && requirements === 0) toast.message('暂无可用的建议映射')
    } catch (e: any) {
      toast.error(e?.message || '获取建议失败')
    }
  }

  const applySuggestions = async () => {
    try {
      const res = await fetch(`${API_BASE}/traceability/apply-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      })
      if (!res.ok) throw new Error('应用建议失败')
      const data = await res.json()
      setSuggestBanner(null)
      toast.success(
        `已保存：需求 ${data?.savedRequirements ?? 0}，映射 ${data?.savedMappings ?? 0}`
      )
      // Refresh test listing and counters
      await fetchTests()
    } catch (e: any) {
      toast.error(e?.message || '应用建议失败')
    }
  }

  return (
    <div className="w-full space-y-6 p-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-semibold">需求 ⇄ 测试 映射</h1>
        <label className="flex flex-col">
          <span className="text-sm text-gray-600 dark:text-gray-300">用户目录</span>
          {sessionUser?.isAdmin ? (
            <OptionsSelect
              key={user || 'none'}
              id="trace-user-select"
              placeholder={users.length ? '选择用户目录' : '无可用用户目录'}
              defaultValue={user || undefined}
              items={users.map<OptionsSelectItem>((u) => ({
                label: u,
                value: u,
              }))}
              onSelect={(item) => setUser(item.value)}
              triggerClassName="bg-white dark:bg-neutral-900 border-gray-300 dark:border-neutral-700"
              contentClassName="w-[200px]"
            />
          ) : (
            <input
              className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 read-only:opacity-80 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
              value={user || sessionUser?.username || ''}
              readOnly
            />
          )}
        </label>
        <Button onClick={fetchTests} disabled={loading || !user}>
          {loading ? '载入中…' : '刷新'}
        </Button>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>需求与映射</CardTitle>
            <CardDescription>输入需求键，并与右侧选中的测试建立映射</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-1 text-sm text-gray-600 dark:text-gray-300">
                需求 Keys（用逗号或换行分隔，如 PROJ-1,PROJ-2）
              </div>
              <textarea
                className="h-40 w-full rounded border border-gray-300 bg-white p-2 text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
                value={reqInput}
                onChange={(e) => setReqInput(e.target.value)}
              />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                已解析：{parseKeys(reqInput).join(', ') || '—'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={upsertRequirements}
                disabled={!user}
                className="bg-indigo-600 text-white transition-colors hover:bg-indigo-700 dark:hover:bg-indigo-500"
              >
                保存需求
              </Button>
              <Button
                onClick={createMappings}
                disabled={!user}
                className="bg-emerald-600 text-white transition-colors hover:bg-emerald-700 dark:hover:bg-emerald-500"
              >
                保存映射（{selectedCount}）
              </Button>
              <Button
                variant="ghost"
                onClick={fetchSuggestions}
                disabled={!user}
                className="hover:bg-accent/60 dark:hover:bg-accent/40"
              >
                查看建议映射
              </Button>
              <Button
                onClick={applySuggestions}
                disabled={!user}
                className="bg-slate-700 text-white transition-colors hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                一键应用建议
              </Button>
            </div>
          </CardContent>
        </Card>
        <Collapsible open={openTests} onOpenChange={setOpenTests} className="block w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>测试列表</CardTitle>
              <CardDescription>
                选择要建立映射的测试
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  合计 {countCombined} 项（静态 {countStatic}，执行 {countExecuted}）
                </span>
                {loading && (
                  <span className="ml-3 inline-flex items-center align-middle text-xs text-gray-500 dark:text-gray-400">
                    <span className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    载入中…
                  </span>
                )}
              </CardDescription>
              <CardAction>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="hover:bg-accent/60 dark:hover:bg-accent/40 text-xs"
                  >
                    {openTests ? '收起' : '展开'}
                  </Button>
                </CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
              <CardContent>
                {suggestBanner && (
                  <Alert className="mb-2 border-l-4 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTitle>发现建议映射</AlertTitle>
                    <AlertDescription>
                      已分析：建议 {suggestBanner.mappings} 条映射，涉及{' '}
                      {suggestBanner.requirements} 个需求。
                      <div className="mt-2 flex gap-2">
                        <Button
                          onClick={applySuggestions}
                          className="bg-amber-600 text-white transition-colors hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
                        >
                          一键应用
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setSuggestBanner(null)}
                          className="hover:bg-accent/60 dark:hover:bg-accent/40"
                        >
                          关闭
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-300">按测试筛选</label>
                    <input
                      value={testQuery}
                      onChange={(e) => setTestQuery(e.target.value)}
                      placeholder="名称或ID关键字"
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      按 Suite 筛选
                    </label>
                    <input
                      value={suiteQuery}
                      onChange={(e) => setSuiteQuery(e.target.value)}
                      placeholder="如 Login 或 Login › smoke"
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-300">
                      按 Module 筛选
                    </label>
                    <input
                      value={moduleQuery}
                      onChange={(e) => setModuleQuery(e.target.value)}
                      placeholder="android/web/generic..."
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={onlyMapped}
                        onChange={(e) => {
                          const v = e.target.checked
                          setOnlyMapped(v)
                          if (v) setOnlyUnmapped(false)
                        }}
                      />
                      只看已映射
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={onlyUnmapped}
                        onChange={(e) => {
                          const v = e.target.checked
                          setOnlyUnmapped(v)
                          if (v) setOnlyMapped(false)
                        }}
                      />
                      只看未映射
                    </label>
                  </div>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>显示 {filteredTests.length} 项</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected((prev) => {
                        const next = { ...prev }
                        const allSelected =
                          filteredTests.length > 0 &&
                          filteredTests.every((t) => !!prev[t.testId])
                        if (allSelected) {
                          for (const t of filteredTests) next[t.testId] = false
                        } else {
                          for (const t of filteredTests) next[t.testId] = true
                        }
                        return next
                      })
                    }}
                    className="rounded border px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                  >
                    全选/反选当前筛选
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected({})}
                    className="rounded border px-2 py-1 text-gray-700 hover:bg-gray-100 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                  >
                    清空选择
                  </button>
                </div>
                <div
                  ref={tableContainerRef}
                  className="max-h-[480px] overflow-auto rounded border border-gray-200 dark:border-neutral-700"
                >
                  <table className="w-full text-sm text-gray-900 dark:text-gray-100">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-neutral-800">
                        <th className="w-10 p-2 text-left">选</th>
                        <th className="p-2 text-left">Test</th>
                        <th className="p-2 text-left">Suite</th>
                        <th className="p-2 text-left">Module</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTests.map((t) => (
                        <tr
                          key={t.testId}
                          className="border-t border-gray-200 dark:border-neutral-700"
                        >
                          <td className="p-2 align-top">
                            <input
                              type="checkbox"
                              checked={!!selected[t.testId]}
                              onChange={(e) =>
                                setSelected((s) => ({
                                  ...s,
                                  [t.testId]: e.target.checked,
                                }))
                              }
                            />
                          </td>
                          <td className="p-2 align-top">
                            <div className="font-medium">{t.name}</div>
                            <div
                              className="truncate text-xs text-gray-500 dark:text-gray-400"
                              title={t.testId}
                            >
                              {t.testId}
                            </div>
                          </td>
                          <td className="p-2 align-top text-xs text-gray-800 dark:text-gray-200">
                            {t.suitePath?.join(' › ')}
                          </td>
                          <td className="p-2 align-top text-xs text-gray-800 dark:text-gray-200">
                            {t.module || '-'}
                          </td>
                        </tr>
                      ))}
                      {!tests.length && (
                        <tr>
                          <td className="p-3 text-gray-500 dark:text-gray-400" colSpan={4}>
                            暂无数据。请确认：
                            <ul className="list-disc pl-5">
                              <li>
                                静态用例目录存在：apps/api/workspace/users/
                                {user || '...'} /cases
                              </li>
                              <li>
                                或已执行过用例，生成报告：apps/api/workspace/users/
                                {user || '...'} /reports
                              </li>
                            </ul>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        {/* 导出卡片（移动至测试列表之后） */}
      </div>

      {/* 映射预览 */}
      <Collapsible
        open={openMappingsCard}
        onOpenChange={setOpenMappingsCard}
        className="block w-full"
      >
        <Card className="w-full">
          <CardHeader>
            <CardTitle>已保存映射</CardTitle>
            <CardDescription>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                共 {mappings.length} 条（当前筛选 {filteredMappings.length}）
              </span>
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReqFilter('')
                    setTestFilter('')
                  }}
                  className="hover:bg-accent/60 dark:hover:bg-accent/40 text-xs"
                >
                  清空筛选
                </Button>
                <Button variant="secondary" onClick={loadMappings} className="text-xs">
                  刷新
                </Button>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="hover:bg-accent/60 dark:hover:bg-accent/40 text-xs"
                  >
                    {openMappingsCard ? '收起' : '展开'}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardAction>
          </CardHeader>
          <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const esc = (v: string) => '"' + (v ?? '').replaceAll('"', '""') + '"'
                    const rows: string[] = []
                    rows.push(
                      ['Requirement', 'System', 'Title', 'TestId', 'LinkType', 'Note'].join(',')
                    )
                    for (const m of filteredMappings) {
                      const req = requirements.find((r) => r.key === m.requirementKey)
                      rows.push(
                        [
                          m.requirementKey,
                          req?.system || '',
                          req?.title || '',
                          m.testId,
                          m.linkType || '',
                          m.note || '',
                        ]
                          .map(esc)
                          .join(',')
                      )
                    }
                    const blob = new Blob([rows.join('\n')], {
                      type: 'text/csv;charset=utf-8',
                    })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'traceability-mappings.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  导出筛选CSV
                </Button>
                <Button
                  onClick={exportFilteredTestrail}
                  disabled={!filteredMappings.length}
                  className="bg-amber-500 text-white transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
                >
                  导出筛选 TestRail
                </Button>
                <Button
                  onClick={exportFilteredXray}
                  disabled={!filteredMappings.length}
                  className="bg-orange-500 text-white transition-colors hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500"
                >
                  导出筛选 Xray
                </Button>
                <Button variant="outline" onClick={() => setGroupByReq((v) => !v)}>
                  {groupByReq ? '列表视图' : '分组视图'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const filtered = filteredMappings
                    const allSelected =
                      filtered.length > 0 &&
                      filtered.every((m) => m.id != null && selectedMapIds.has(m.id))
                    const next = new Set(selectedMapIds)
                    if (allSelected) {
                      for (const m of filtered) if (m.id != null) next.delete(m.id)
                    } else {
                      for (const m of filtered) if (m.id != null) next.add(m.id)
                    }
                    setSelectedMapIds(next)
                  }}
                  className="hover:bg-accent/60 dark:hover:bg-accent/40"
                >
                  全选/反选筛选结果
                </Button>
                <Button
                  variant="destructive"
                  disabled={selectedMapIds.size === 0}
                  onClick={async () => {
                    if (selectedMapIds.size === 0) return
                    const ok = window.confirm(`确认删除选中的 ${selectedMapIds.size} 条映射吗？`)
                    if (!ok) return
                    try {
                      const ids = Array.from(selectedMapIds)
                      const res = await fetch(`${API_BASE}/traceability/mappings`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids }),
                      })
                      if (!res.ok) throw new Error('删除失败')
                      const data = await res.json()
                      toast.success(`已删除 ${data?.deleted ?? ids.length} 条映射`)
                      await loadMappings()
                    } catch (e: any) {
                      toast.error(e?.message || '删除失败')
                    }
                  }}
                >
                  批量删除
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-300">按需求筛选</label>
                  <input
                    value={reqFilter}
                    onChange={(e) => setReqFilter(e.target.value)}
                    placeholder="如 PROJ-123"
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-300">按测试筛选</label>
                  <input
                    value={testFilter}
                    onChange={(e) => setTestFilter(e.target.value)}
                    placeholder="如 Login › logs in 或 Class.test_xx"
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100"
                  />
                </div>
              </div>
              {groupByReq ? (
                <div className="space-y-2">
                  {Object.entries(
                    filteredMappings.reduce(
                      (acc, m) => {
                        ;(acc[m.requirementKey] = acc[m.requirementKey] || []).push(m)
                        return acc
                      },
                      {} as Record<string, typeof filteredMappings>
                    )
                  ).map(([reqKey, items]) => {
                    const req = requirements.find((r) => r.key === reqKey)
                    const allSelected = items.every(
                      (m) => m.id != null && selectedMapIds.has(m.id!)
                    )
                    return (
                      <details
                        key={reqKey}
                        className="rounded border border-gray-200 dark:border-neutral-700"
                      >
                        <summary className="cursor-pointer bg-gray-50 p-2 text-sm select-none dark:bg-neutral-800">
                          <span className="font-medium">{reqKey}</span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {req?.system || '-'} · {items.length} 条
                          </span>
                          {req?.title && (
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              {req.title}
                            </span>
                          )}
                          <span className="ml-3 inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => {
                                const next = new Set(selectedMapIds)
                                if (e.target.checked) {
                                  for (const m of items) if (m.id != null) next.add(m.id)
                                } else {
                                  for (const m of items) if (m.id != null) next.delete(m.id)
                                }
                                setSelectedMapIds(next)
                              }}
                              title="选择/取消该需求下所有映射"
                            />
                          </span>
                        </summary>
                        <div className="max-h-[260px] overflow-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-neutral-900">
                                <th className="w-10 p-2 text-left">选</th>
                                <th className="p-2 text-left">测试</th>
                                <th className="p-2 text-left">备注</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((m, i) => (
                                <tr
                                  key={`${m.testId}@@${i}`}
                                  className="border-t border-gray-200 dark:border-neutral-700"
                                >
                                  <td className="p-2 align-top">
                                    <input
                                      type="checkbox"
                                      checked={m.id != null && selectedMapIds.has(m.id)}
                                      onChange={(e) => {
                                        const next = new Set(selectedMapIds)
                                        if (m.id == null) return
                                        if (e.target.checked) next.add(m.id)
                                        else next.delete(m.id)
                                        setSelectedMapIds(next)
                                      }}
                                    />
                                  </td>
                                  <td className="p-2 align-top text-xs break-all text-gray-800 dark:text-gray-200">
                                    {m.testId}
                                  </td>
                                  <td className="p-2 align-top text-xs text-gray-800 dark:text-gray-200">
                                    {m.note || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )
                  })}
                  {filteredMappings.length === 0 && (
                    <div className="rounded border border-gray-200 p-3 text-sm text-gray-500 dark:border-neutral-700 dark:text-gray-400">
                      无匹配的映射。
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-[360px] overflow-auto rounded border border-gray-200 dark:border-neutral-700">
                  <table className="w-full text-sm text-gray-900 dark:text-gray-100">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-neutral-800">
                        <th className="w-10 p-2 text-left">
                          <input
                            type="checkbox"
                            checked={(() => {
                              return (
                                filteredMappings.length > 0 &&
                                filteredMappings.every((m) => m.id && selectedMapIds.has(m.id))
                              )
                            })()}
                            onChange={(e) => {
                              const checked = e.target.checked
                              const next = new Set(selectedMapIds)
                              if (checked) {
                                for (const m of filteredMappings) if (m.id != null) next.add(m.id)
                              } else {
                                for (const m of filteredMappings)
                                  if (m.id != null) next.delete(m.id)
                              }
                              setSelectedMapIds(next)
                            }}
                          />
                        </th>
                        <th className="p-2 text-left">需求</th>
                        <th className="p-2 text-left">系统</th>
                        <th className="p-2 text-left">测试</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMappings.map((m, idx) => {
                        const req = requirements.find((r) => r.key === m.requirementKey)
                        return (
                          <tr
                            key={`${m.requirementKey}@@${m.testId}@@${idx}`}
                            className="border-t border-gray-200 dark:border-neutral-700"
                          >
                            <td className="p-2 align-top">
                              <input
                                type="checkbox"
                                checked={m.id != null && selectedMapIds.has(m.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedMapIds)
                                  if (m.id == null) return
                                  if (e.target.checked) next.add(m.id)
                                  else next.delete(m.id)
                                  setSelectedMapIds(next)
                                }}
                              />
                            </td>
                            <td className="p-2 align-top">
                              <div className="font-medium">{m.requirementKey}</div>
                              {req?.title && (
                                <div
                                  className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400"
                                  title={req.title}
                                >
                                  {req.title}
                                </div>
                              )}
                            </td>
                            <td className="p-2 align-top text-xs text-gray-800 dark:text-gray-200">
                              {req?.system || '-'}
                            </td>
                            <td className="p-2 align-top text-xs break-all text-gray-800 dark:text-gray-200">
                              {m.testId}
                            </td>
                          </tr>
                        )
                      })}
                      {!filteredMappings.length && (
                        <tr>
                          <td className="p-3 text-gray-500 dark:text-gray-400" colSpan={4}>
                            无匹配的映射。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
