'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '@/app/context/session-context'
import { OptionsSelect, type OptionsSelectItem } from '@/components/select/options-select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  X,
  Download as DownloadIcon,
  Loader2,
  Eraser,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react'
import ResizableStickyTable, { SortDir } from '@/components/data-table'
import { buildColumns, buildCompareFns, type Review } from './table-defs'
import TablePagination from '@/components/table-pagination'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

export default function StoreCommentsPage() {
  const { user: sessionUser } = useSession()
  const LS_BASE = 'tools:store-comments:state'
  const storeOptions: OptionsSelectItem[] = useMemo(
    () => [
      { label: 'google store', value: 'google' },
      { label: 'apple store', value: 'apple' },
    ],
    []
  )
  const langOptions: OptionsSelectItem[] = useMemo(
    () => [
      { label: 'English', value: 'en' },
      { label: 'Chinese', value: 'zh' },
      { label: 'other', value: 'other' },
    ],
    []
  )
  const regionOptionsAll = useMemo(
    () => [
      { label: 'United States', value: 'us' },
      { label: 'United Kingdom', value: 'gb' },
      { label: 'Germany', value: 'de' },
      { label: 'France', value: 'fr' },
      { label: 'Japan', value: 'jp' },
      { label: 'China', value: 'cn' },
      { label: 'Australia', value: 'au' },
      { label: 'Canada', value: 'ca' },
      { label: 'Brazil', value: 'br' },
      { label: 'India', value: 'in' },
    ],
    []
  )

  const [store, setStore] = useState<OptionsSelectItem>(storeOptions[0])
  const [lang, setLang] = useState<OptionsSelectItem>(langOptions[0])
  const [region, setRegion] = useState<{ label: string; value: string }>({
    label: 'Main market',
    value: 'main',
  })
  const [regions, setRegions] = useState<string[]>([])
  const [pkg, setPkg] = useState('com.gettr.gettr')
  const [loading, setLoading] = useState(false)
  const [num, setNum] = useState<number>(100)
  // Keep datasets per store and derive current rows from selection
  const [rowsByStore, setRowsByStore] = useState<Record<string, Review[]>>({})
  const rows = useMemo(() => rowsByStore[store.value] || [], [rowsByStore, store.value])
  const setRowsCurrent = (updater: Review[] | ((prev: Review[]) => Review[])) => {
    setRowsByStore((prev) => {
      const cur = prev[store.value] || []
      const nextArr = typeof updater === 'function' ? (updater as any)(cur) : updater
      return { ...prev, [store.value]: nextArr }
    })
  }
  const [query, setQuery] = useState('')
  const [minScore, setMinScore] = useState<number>(0)
  const [minThumbs, setMinThumbs] = useState<number>(0)
  const [sortKey, setSortKey] = useState<'date' | 'score' | 'thumbsUp' | 'version'>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [appendMode, setAppendMode] = useState(false)
  const [appendDefault, setAppendDefault] = useState(false)
  const [dedupOnAppend, setDedupOnAppend] = useState(true)
  const [exhaustive, setExhaustive] = useState(false)
  const [maxPages, setMaxPages] = useState<number>(50)
  const [start, setStart] = useState<string>(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }) // default to 3 months ago

  // Compute current localStorage key by user + package
  const currentLsKey = useMemo(
    () => `${LS_BASE}:${sessionUser?.username || 'anon'}:${pkg || 'default'}`,
    [sessionUser?.username, pkg]
  )
  const restoredKeyRef = useRef<string>('')
  // Restore state when key changes (on first mount and when user/pkg switch)
  useEffect(() => {
    if (!currentLsKey || restoredKeyRef.current === currentLsKey) return
    try {
      const raw = localStorage.getItem(currentLsKey) || localStorage.getItem(LS_BASE) // fallback legacy
      if (!raw) {
        restoredKeyRef.current = currentLsKey
        return
      }
      const data = JSON.parse(raw)
      if (data?.store) setStore(data.store)
      if (data?.lang) setLang(data.lang)
      if (Array.isArray(data?.regions)) setRegions(data.regions)
      if (data?.region) setRegion(data.region)
      if (typeof data?.pkg === 'string') setPkg(data.pkg)
      if (Number.isFinite(data?.num)) setNum(data.num)
      if (typeof data?.start === 'string') setStart(data.start)
      if (typeof data?.query === 'string') setQuery(data.query)
      if (Number.isFinite(data?.minScore)) setMinScore(data.minScore)
      if (Number.isFinite(data?.minThumbs)) setMinThumbs(data.minThumbs)
      if (data?.sortKey) setSortKey(data.sortKey)
      if (data?.sortDir) setSortDir(data.sortDir)
      if (Number.isFinite(data?.page)) setPage(Math.max(1, data.page))
      if (Number.isFinite(data?.pageSize)) setPageSize(Math.max(10, data.pageSize))
      if (data?.rowsByStore && typeof data.rowsByStore === 'object') {
        setRowsByStore(data.rowsByStore as Record<string, Review[]>)
      } else if (Array.isArray(data?.rows)) {
        // backward compatibility
        const lastStore = (data?.store?.value || data?.store?.toString?.() || store.value) as string
        setRowsByStore({ [lastStore]: data.rows as Review[] })
      }
      if (typeof data?.appendDefault === 'boolean') setAppendDefault(!!data.appendDefault)
      if (typeof data?.dedupOnAppend === 'boolean') setDedupOnAppend(!!data.dedupOnAppend)
      if (Number.isFinite(data?.maxPages)) {
        const v = Math.max(1, Math.min(200, Number(data.maxPages)))
        setMaxPages(v)
      }
    } catch {}
    restoredKeyRef.current = currentLsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLsKey])

  // Keep appendMode aligned with default on store change or default change
  useEffect(() => {
    setAppendMode(appendDefault)
  }, [appendDefault, store?.value])

  // Persist state to localStorage (per-user + per-package)
  useEffect(() => {
    try {
      const payload = {
        store,
        lang,
        region,
        regions,
        pkg,
        num,
        start,
        query,
        minScore,
        minThumbs,
        sortKey,
        sortDir,
        page,
        pageSize,
        rowsByStore,
        appendDefault,
        dedupOnAppend,
        exhaustive,
        maxPages,
      }
      if (currentLsKey) localStorage.setItem(currentLsKey, JSON.stringify(payload))
    } catch {}
  }, [
    currentLsKey,
    store,
    lang,
    region,
    regions,
    pkg,
    num,
    start,
    query,
    minScore,
    minThumbs,
    sortKey,
    sortDir,
    page,
    pageSize,
    rowsByStore,
  ])

  // Load last-update for current store and update the date control directly
  useEffect(() => {
    const toInputDT = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    const parseBackendTs = (s: string) => {
      const m = (s || '').match(/^(\d{4})\/(\d{2})\/(\d{2}):(\d{2}):(\d{2}):(\d{2})$/)
      if (m) {
        const [_, y, mo, da, h, mi, se] = m
        const d = new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se))
        if (isFinite(d.getTime())) return d
      }
      const t = Date.parse(s)
      return Number.isFinite(t) ? new Date(t) : null
    }
    const load = async () => {
      try {
        const res = await fetch('/api/settings/store-last-update', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        const map =
          data?.map && typeof data.map === 'object' ? (data.map as Record<string, string>) : {}
        const ts = map?.[store.value]
        if (ts) {
          const d = parseBackendTs(ts)
          if (d) setStart(toInputDT(d))
        }
      } catch {}
    }
    load()
  }, [store?.value])

  const toggleSort = (key: 'date' | 'score' | 'thumbsUp' | 'version') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const parseVersion = (s?: string): number[] => {
    if (!s) return [-1]
    const parts = String(s)
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map((x) => parseInt(x, 10))
    return parts.length ? parts : [-1]
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows.filter((r) => (minScore ? (r.score ?? 0) <= minScore : true))
    if (q) {
      out = out.filter(
        (r) =>
          (r.text || '').toLowerCase().includes(q) ||
          (r.title || '').toLowerCase().includes(q) ||
          (r.userName || '').toLowerCase().includes(q)
      )
    }
    return out
  }, [rows, query, minScore, minThumbs, sortKey, sortDir])

  // Helpers: columns + comparators for the reusable table
  const columns = useMemo(
    () =>
      buildColumns({
        onDeleteRow: (r) => {
          setRowsCurrent((prev) => prev.filter((it) => it !== r))
          setSelectedKeys(new Set())
        },
      }),
    [store?.value]
  )
  const compareFns = useMemo(() => buildCompareFns(), [])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  useEffect(() => {
    setSelectedKeys(new Set())
    setPage(1)
  }, [store?.value])
  const makeRowKey = (r: Review, _globalIndex: number) => {
    if (r.id && String(r.id).trim()) return String(r.id)
    const norm = (s?: string) => (s || '').trim().toLowerCase()
    return [norm(r.userName), norm(r.title), norm(r.text), norm(r.date), norm(r.version)].join('||')
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)))
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const download = async () => {
    setLoading(true)
    try {
      const ds = start ? new Date(start) : null
      const res = await fetch(`/api/store-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: store.value,
          lang: lang.value,
          region: region.value,
          regions: regions.length ? regions : undefined,
          packageId: pkg,
          num,
          dateStart: ds && isFinite(ds.getTime()) ? ds.toISOString() : undefined,
          exhaustive,
          maxPages,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'failed to fetch reviews')
      }
      const data = await res.json()
      const list: Review[] = Array.isArray(data?.items) ? data.items : []
      if (!appendMode) {
        setRowsCurrent(list)
      } else {
        if (!dedupOnAppend) {
          setRowsCurrent((prev) => [...prev, ...list])
        } else {
          const norm = (s?: string) => (s || '').trim().toLowerCase()
          const keyOf = (r: Review) =>
            (r.id && String(r.id).trim()) ||
            `${norm(r.title)}||${norm(r.userName)}||${norm(r.date)}`
          setRowsCurrent((prev) => {
            const seen = new Set<string>(prev.map(keyOf))
            const add = list.filter((r) => {
              const k = keyOf(r)
              if (seen.has(k)) return false
              seen.add(k)
              return true
            })
            return [...prev, ...add]
          })
        }
      }
      // Determine newest date from data
      const parseDate = (s?: string) => {
        if (!s) return NaN
        const t = Date.parse(s)
        return Number.isFinite(t) ? t : NaN
      }
      let maxTs = -1
      for (const r of list) {
        const t = parseDate(r.date)
        if (Number.isFinite(t) && t > maxTs) maxTs = t
      }
      if (maxTs > 0) {
        const d = new Date(maxTs)
        const pad = (n: number) => String(n).padStart(2, '0')
        const fmt = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}:${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        // Also update the date control to this timestamp
        const inputFmt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        setStart(inputFmt)
        // Persist to backend and update UI map
        try {
          const put = await fetch('/api/settings/store-last-update', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              store: store.value,
              lastUpdate: fmt,
              alsoSetAppStore: true,
            }),
          })
          // No UI label to update; ignore response
        } catch {}
      }
      toast.success(`Downloaded ${list.length} reviews`)
    } catch (e: any) {
      toast.error(e?.message || 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = (items: Review[]) => {
    if (!items.length) return toast.message('No data to export')
    const header = [
      'store',
      'lang',
      'region',
      'package',
      'append',
      'dedupOnAppend',
      'exhaustive',
      'maxPages',
      'id',
      'userName',
      'date',
      'score',
      'version',
      'thumbsUp',
      'title',
      'text',
    ]
    const esc = (v: any) => '"' + String(v ?? '').replaceAll('"', '""') + '"'
    const lines = [header.join(',')]
    for (const r of items) {
      lines.push(
        [
          r.store,
          r.lang,
          r.region,
          r.packageId,
          appendMode,
          dedupOnAppend,
          exhaustive,
          maxPages,
          r.id,
          r.userName,
          r.date,
          r.score,
          r.version,
          r.thumbsUp,
          r.title,
          r.text,
        ]
          .map(esc)
          .join(',')
      )
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safe = (s?: string) => (s ? s.replace(/[:]/g, '-') : '')
    const startStr = start ? safe(start) : ''
    const range = startStr ? `.${startStr}` : ''
    const regionForName = regions.length ? 'multi' : region.value
    a.download = `store-comments.${store.value}.${lang.value}.${regionForName}${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // CSV import
  const fileRef = useRef<HTMLInputElement | null>(null)
  const triggerImport = () => fileRef.current?.click()

  function parseCsv(text: string): string[][] {
    const rows: string[][] = []
    let i = 0
    const n = text.length
    let field = ''
    let row: string[] = []
    let inQuotes = false
    while (i < n) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < n && text[i + 1] === '"') {
            field += '"'
            i += 2
            continue
          } else {
            inQuotes = false
            i += 1
            continue
          }
        } else {
          field += ch
          i += 1
          continue
        }
      } else {
        if (ch === '"') {
          inQuotes = true
          i += 1
          continue
        }
        if (ch === ',') {
          row.push(field)
          field = ''
          i += 1
          continue
        }
        if (ch === '\n' || ch === '\r') {
          // handle CRLF/CR
          if (ch === '\r' && i + 1 < n && text[i + 1] === '\n') i += 1
          row.push(field)
          rows.push(row)
          row = []
          field = ''
          i += 1
          continue
        }
        field += ch
        i += 1
      }
    }
    // flush last field
    row.push(field)
    if (row.length === 1 && row[0] === '') {
      // trailing newline
    } else {
      rows.push(row)
    }
    return rows
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      const grid = parseCsv(text)
      if (!grid.length) return toast.message('Empty CSV')
      const header = grid[0].map((h) => (h || '').trim())
      const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase())
      const get = (row: string[], name: string) => {
        const i = idx(name)
        return i >= 0 ? row[i] : ''
      }
      const out: Review[] = []
      for (let r = 1; r < grid.length; r++) {
        const row = grid[r]
        if (!row || row.length === 0) continue
        const review: Review = {
          store: get(row, 'store') || undefined,
          lang: get(row, 'lang') || undefined,
          region: get(row, 'region') || undefined,
          packageId: get(row, 'package') || undefined,
          id: get(row, 'id') || undefined,
          userName: get(row, 'userName') || get(row, 'user') || undefined,
          date: get(row, 'date') || undefined,
          score: (() => {
            const v = parseFloat(get(row, 'score') || '')
            return Number.isFinite(v) ? v : undefined
          })(),
          version: get(row, 'version') || undefined,
          thumbsUp: (() => {
            const v = parseInt(get(row, 'thumbsUp') || get(row, 'helpful') || '', 10)
            return Number.isFinite(v) ? v : undefined
          })(),
          title: get(row, 'title') || undefined,
          text: get(row, 'text') || undefined,
        }
        out.push(review)
      }
      // Apply to current store dataset with Append option and optional dedup
      if (!appendMode) {
        setRowsCurrent(out)
      } else {
        if (!dedupOnAppend) {
          setRowsCurrent((prev) => [...prev, ...out])
        } else {
          const norm = (s?: string) => (s || '').trim().toLowerCase()
          const keyOf = (r: Review) =>
            (r.id && String(r.id).trim()) ||
            `${norm(r.title)}||${norm(r.userName)}||${norm(r.date)}`
          setRowsCurrent((prev) => {
            const seen = new Set<string>(prev.map(keyOf))
            const add = out.filter((r) => {
              const k = keyOf(r)
              if (seen.has(k)) return false
              seen.add(k)
              return true
            })
            return [...prev, ...add]
          })
        }
      }
      setSelectedKeys(new Set())
      setPage(1)
      toast.success(`Imported ${out.length} rows`)
    } catch (err: any) {
      toast.error(err?.message || 'Import failed')
    } finally {
      // reset input value to allow re-import same file
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex w-full flex-col space-y-4 overflow-auto border-1 p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36 shrink-0">
          <OptionsSelect
            id="store-select"
            items={storeOptions}
            value={store.value}
            onSelect={(i) => setStore(i)}
            placeholder="Store"
            contentClassName="w-[140px]"
          />
        </div>
        <div className="w-36 shrink-0">
          <OptionsSelect
            id="lang-select"
            items={langOptions}
            value={lang.value}
            onSelect={(i) => setLang(i)}
            placeholder="Language"
            contentClassName="w-[140px]"
          />
        </div>
        <div className="w-44 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Regions{regions.length ? ` (${regions.length})` : ' (Main)'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="mb-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRegions(['us', 'gb', 'de', 'fr', 'jp', 'cn', 'au', 'ca'])}
                >
                  Main markets
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRegions([])}>
                  Clear
                </Button>
              </div>
              <div className="max-h-56 overflow-auto pr-1">
                {regionOptionsAll.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                  >
                    <Checkbox
                      checked={regions.includes(opt.value)}
                      onCheckedChange={(v) => {
                        setRegions((prev) => {
                          const sel = new Set(prev)
                          if (v) sel.add(opt.value)
                          else sel.delete(opt.value)
                          return Array.from(sel)
                        })
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-28 shrink-0">
          <Input
            type="number"
            min={1}
            max={1000}
            value={num}
            onChange={(e) => setNum(Math.max(1, Math.min(1000, Number(e.target.value) || 0)))}
            placeholder="Count"
          />
        </div>
        <div className="w-[200px] shrink-0">
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="Start"
          />
        </div>
        {/* Removed end datetime to keep only start time control */}
        <div className="min-w-[220px] flex-1">
          <Input value={pkg} onChange={(e) => setPkg(e.target.value)} />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Options" aria-label="Options">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span>Append</span>
                <Checkbox checked={appendMode} onCheckedChange={(v) => setAppendMode(!!v)} />
              </label>
              <label className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <span>Append by default</span>
                <Checkbox checked={appendDefault} onCheckedChange={(v) => setAppendDefault(!!v)} />
              </label>
              <label className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <span>Dedup on append</span>
                <Checkbox checked={dedupOnAppend} onCheckedChange={(v) => setDedupOnAppend(!!v)} />
              </label>
              <label className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <span>Exhaustive (since Start)</span>
                <Checkbox checked={exhaustive} onCheckedChange={(v) => setExhaustive(!!v)} />
              </label>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span>Max pages</span>
                <Input
                  type="number"
                  className="h-8 w-20"
                  min={1}
                  max={200}
                  value={maxPages}
                  onChange={(e) =>
                    setMaxPages(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                  }
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          onClick={download}
          disabled={loading}
          className="shrink-0 bg-indigo-600 text-white"
          size="icon"
          title={loading ? 'Downloading…' : 'Download'}
          aria-label="Download"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DownloadIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded border border-gray-200 p-2 dark:border-neutral-700">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Input
              className="h-9 w-[220px]"
              placeholder="Search text/title/user"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
            />
            <span>Score ≤</span>
            <Input
              type="number"
              min={0}
              max={5}
              className="h-9 w-[80px]"
              value={minScore}
              onChange={(e) => {
                setMinScore(Math.max(0, Math.min(5, Number(e.target.value) || 0)))
                setPage(1)
              }}
            />
            {/* Thumbs filter removed as requested; header provides sorting */}
            <span>Page size</span>
            <Input
              type="number"
              min={10}
              max={500}
              className="h-9 w-[80px]"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Math.max(10, Math.min(500, Number(e.target.value) || 10)))
                setPage(1)
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem
                  onClick={() => exportCsv(filtered)}
                  className={!filtered.length ? 'pointer-events-none opacity-50' : ''}
                >
                  Export Filtered
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const base = (page - 1) * pageSize
                    const sel = paged.filter((r, i) => selectedKeys.has(makeRowKey(r, base + i)))
                    exportCsv(sel)
                  }}
                  className={
                    selectedKeys.size === 0 ||
                    !paged.some((r, i) =>
                      selectedKeys.has(makeRowKey(r, (page - 1) * pageSize + i))
                    )
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }
                >
                  Export Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              type="file"
              accept=".csv,text/csv"
              ref={fileRef}
              onChange={handleImportFile}
              className="hidden"
            />
            <Button variant="outline" onClick={triggerImport}>
              Import
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Remove duplicates"
              aria-label="Remove duplicates"
              onClick={() => {
                const seen = new Set<string>()
                let removed = 0
                const norm = (s?: string) => (s || '').trim().toLowerCase()
                const next = rows.filter((r) => {
                  const key = `${norm(r.title)}||${norm(r.userName)}`
                  if (seen.has(key)) {
                    removed += 1
                    return false
                  }
                  seen.add(key)
                  return true
                })
                setRowsCurrent(next)
                setSelectedKeys(new Set())
                setPage(1)
                toast.success(`Removed ${removed} duplicate rows`)
              }}
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              title="Delete selected"
              aria-label="Delete selected"
              onClick={() => {
                // Delete selections across ALL pages based on current filtered ordering
                const toRemove = new Set<Review>()
                filtered.forEach((r, i) => {
                  if (selectedKeys.has(makeRowKey(r, i))) toRemove.add(r)
                })
                if (toRemove.size === 0) return
                setRowsCurrent((prev) => prev.filter((r) => !toRemove.has(r)))
                setSelectedKeys(new Set())
                setPage(1)
                toast.success(`Deleted ${toRemove.size} selected rows`)
              }}
              className={
                selectedKeys.size === 0 ||
                !filtered.some((r, i) => selectedKeys.has(makeRowKey(r, i)))
                  ? 'pointer-events-none opacity-50'
                  : ''
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Clear filters"
              onClick={() => {
                setQuery('')
                setMinScore(0)
                setMinThumbs(0)
                setSortKey('date')
                setSortDir('desc')
                setPage(1)
                setSelectedKeys(new Set())
              }}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setRowsCurrent([])
                setSelectedKeys(new Set())
                setPage(1)
                toast.success('Cleared current store data')
              }}
            >
              Clear Current
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setRowsByStore({})
                setSelectedKeys(new Set())
                setPage(1)
                toast.success('Cleared all stores data')
              }}
            >
              Clear All Stores
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border-1">
          <ResizableStickyTable
            rows={filtered}
            columns={useMemo(
              () =>
                buildColumns({
                  onDeleteRow: (r) => {
                    setRowsCurrent((prev) => prev.filter((it) => it !== r))
                    setSelectedKeys(new Set())
                  },
                }),
              [store?.value]
            )}
            getRowKey={makeRowKey}
            page={page}
            pageSize={pageSize}
            density="compact"
            selection={{
              enabled: true,
              keys: selectedKeys,
              onChange: setSelectedKeys,
              width: 40,
              minWidth: 36,
            }}
            sortKey={sortKey}
            sortDir={sortDir as SortDir}
            onSortChange={(k, d) => {
              setSortKey(k as any as 'date' | 'score' | 'thumbsUp' | 'version')
              setSortDir(d)
            }}
            compareFns={compareFns}
            containerClassName="h-full overflow-x-auto overflow-y-auto border-1"
          />
        </div>
        <TablePagination
          className="mt-2 text-sm"
          page={page}
          totalPages={totalPages}
          totalRows={filtered.length}
          pageSize={pageSize}
          pageSizeMin={10}
          pageSizeMax={500}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </div>
    </div>
  )
}
