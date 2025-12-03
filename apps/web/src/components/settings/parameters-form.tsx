'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useSession } from '@/app/context/session-context'
import { cn } from '@/lib/utils'

export type ParametersFormHandle = {
  save: () => void
  reset: () => void
}

export type ParametersFormProps = {
  hideActions?: boolean
}

type SectionProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}

function Section({ title, description, children, className, bodyClassName }: SectionProps) {
  return (
    <section className={cn('bg-card text-card-foreground rounded-xl border shadow-sm', className)}>
      <header className="border-b px-4 py-3">
        <h2 className="text-base leading-6 font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </header>
      <div className={cn('space-y-6 px-4 py-4', bodyClassName)}>{children}</div>
    </section>
  )
}

function readBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v == null) return def
    return v === '1' || v === 'true'
  } catch {
    return def
  }
}

function readStr(key: string, def: string): string {
  try {
    const v = localStorage.getItem(key)
    return v == null ? def : v
  } catch {
    return def
  }
}

function readInt(key: string, def: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return def
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : def
  } catch {
    return def
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

type AiProvider = 'openai' | 'azure' | 'custom' | 'grok'

const normalizeAiProvider = (value: string | null | undefined): AiProvider => {
  const normalized = (value || '').toLowerCase()
  return normalized === 'azure' || normalized === 'custom' || normalized === 'grok'
    ? (normalized as AiProvider)
    : 'openai'
}

export const ParametersForm = forwardRef<ParametersFormHandle, ParametersFormProps>(
  function ParametersForm({ hideActions = false }, ref) {
    const { isAuthenticated } = useSession()

    // Inspector - Snapshot unlock/wake
    const [inspectorAutoWake, setInspectorAutoWake] = useState(true)
    const [inspectorAutoUnlock, setInspectorAutoUnlock] = useState(false)
    const [unlockPassword, setUnlockPassword] = useState('')
    const [unlockSwipe, setUnlockSwipe] = useState('')
    const [unlockKeywords, setUnlockKeywords] = useState('holding display')

    const keywordPresets = useMemo(
      () => [
        {
          id: 'holding-display',
          label: 'holding display',
          value: 'holding display',
        },
        {
          id: 'display-on',
          label: 'Display Power: state=ON',
          value: 'Display Power: state=ON',
        },
        { id: 'awake', label: 'mWakefulness=Awake', value: 'mWakefulness=Awake' },
        { id: 'screen-on', label: 'mScreenOn=true', value: 'mScreenOn=true' },
        {
          id: 'suspend-blocker',
          label: 'mHoldingDisplaySuspendBlocker=true',
          value: 'mHoldingDisplaySuspendBlocker=true',
        },
      ],
      []
    )

    const [keywordsPresetId, setKeywordsPresetId] = useState('holding-display')

    // Inspector - list refresh (emulators/devices) & Appium polling reuse
    const [inspectorListsAuto, setInspectorListsAuto] = useState(true)
    const [inspectorListsSec, setInspectorListsSec] = useState(3)

    // Inspector - Snapshot auto refresh
    const [snapshotAuto, setSnapshotAuto] = useState(false)
    const [snapshotMs, setSnapshotMs] = useState(1200)
    const [snapshotAttempts, setSnapshotAttempts] = useState(10)
    const [inspectorClickableOnly, setInspectorClickableOnly] = useState(true)
    const [inspectorPreferAppium, setInspectorPreferAppium] = useState(false)
    const [inspectorOverlayMode, setInspectorOverlayMode] = useState<'boxes' | 'markers'>('boxes')
    const [fsOnAdbFail, setFsOnAdbFail] = useState(false)
    const [fsFailN, setFsFailN] = useState(2)
    const [fsCooldownMs, setFsCooldownMs] = useState(60000)
    // Inspector - warm cache (for cross-page snapshot warm start)
    const [inspectorWarmEnabled, setInspectorWarmEnabled] = useState(true)
    const [inspectorCacheTtl, setInspectorCacheTtl] = useState(15000)

    // Testcases & Libs - Appium polling
    const [tcAppiumAuto, setTcAppiumAuto] = useState(true)
    const [libsAppiumAuto, setLibsAppiumAuto] = useState(true)
    const [libsEditorWrapColumn, setLibsEditorWrapColumn] = useState(80)

    // Libs AI defaults
    const [aiRulesOnlyDefault, setAiRulesOnlyDefault] = useState(false)
    const [docAiHint, setDocAiHint] = useState<string>('')
    const [aiMaxLinesDefault, setAiMaxLinesDefault] = useState(0)
    const [aiMaxColDefault, setAiMaxColDefault] = useState(0)

    // AI backend config (server-side)
    const [aiProvider, setAiProvider] = useState<AiProvider>('openai')
    const [aiModel, setAiModel] = useState('gpt-4o-mini')
    const [aiBaseUrl, setAiBaseUrl] = useState('')
    const [aiHasKey, setAiHasKey] = useState(false)
    const [aiApiKeyInput, setAiApiKeyInput] = useState('')
    const [aiClearKey, setAiClearKey] = useState(false)
    const [aiTimeoutMsValue, setAiTimeoutMsValue] = useState(10000)
    const [aiMaxTokens, setAiMaxTokens] = useState(512)

    const [loggerFilePath, setLoggerFilePath] = useState('')
    const [loggerFileLevel, setLoggerFileLevel] = useState<
      'error' | 'warn' | 'tc' | 'info' | 'debug'
    >('error')
    const [loggerMaxSizeMbInput, setLoggerMaxSizeMbInput] = useState('20')
    const [loggerMaxFilesInput, setLoggerMaxFilesInput] = useState('30')
    const [loggerZippedArchive, setLoggerZippedArchive] = useState(true)
    const [loggerAccessDenied, setLoggerAccessDenied] = useState(false)
    const [loggerLoading, setLoggerLoading] = useState(false)
    const loggerInitialRef = useRef<{
      filePath: string
      fileLevel: 'error' | 'warn' | 'tc' | 'info' | 'debug'
      maxSizeMb: string
      maxFiles: string
      zippedArchive: boolean
    } | null>(null)

    // Redis connections mapping (front-end presets)
    // Stored in localStorage under key 'gtt:redis:connections'
    const [redisConnsInput, setRedisConnsInput] = useState('')
    const [redisConnsError, setRedisConnsError] = useState<string | null>(null)

    // API tests config (backend)
    const [apiBaseUrl, setApiBaseUrl] = useState('')
    const [apiHeadersInput, setApiHeadersInput] = useState('')
    const [apiHeadersError, setApiHeadersError] = useState<string | null>(null)
    const [apiSampleLivePostId, setApiSampleLivePostId] = useState('')

    useEffect(() => {
      // Local persisted settings (Inspector/Testcases/Libs)
      setInspectorAutoWake(readBool('gtt:inspector:autoWake', true))
      setInspectorAutoUnlock(readBool('gtt:inspector:autoUnlock', false))
      setUnlockPassword(readStr('gtt:inspector:unlockPassword', ''))
      setUnlockSwipe(readStr('gtt:inspector:unlockSwipe', ''))
      setUnlockKeywords(readStr('gtt:inspector:unlockKeywords', 'holding display'))
      setKeywordsPresetId(readStr('gtt:inspector:unlockKeywordsPreset', 'holding-display'))

      setInspectorListsAuto(readBool('gtt:inspector:lists:autoRefresh', true))
      setInspectorListsSec(clamp(readInt('gtt:inspector:lists:refreshSec', 3), 1, 60))

      setSnapshotAuto(readBool('gtt:inspector:snapshot:autoRefresh', false))
      setSnapshotMs(clamp(readInt('gtt:inspector:snapshot:intervalMs', 1200), 100, 3000))
      setSnapshotAttempts(clamp(readInt('gtt:inspector:snapshot:maxAttempts', 10), 1, 20))
      setInspectorClickableOnly(readBool('gtt:inspector:clickableOnly', true))
      setInspectorPreferAppium(readBool('gtt:inspector:preferAppiumSource', false))
      setInspectorWarmEnabled(readBool('gtt:inspector:cacheWarmEnabled', true))
      setInspectorCacheTtl(clamp(readInt('gtt:inspector:cacheTtlMs', 15000), 1000, 60000))
      try {
        const m = localStorage.getItem('gtt:inspector:overlayMode')
        setInspectorOverlayMode(m === 'markers' ? 'markers' : 'boxes')
      } catch {}
      setFsOnAdbFail(readBool('gtt:inspector:fsOnAdbFail', false))
      setFsFailN(clamp(readInt('gtt:inspector:fsFailN', 2), 1, 10))
      setFsCooldownMs(clamp(readInt('gtt:inspector:fsCooldownMs', 60000), 0, 600000))

      setTcAppiumAuto(readBool('gtt:testcases:appiumAutoRefresh', true))
      setLibsAppiumAuto(readBool('gtt:testcases-libs:appiumAutoRefresh', true))
      setLibsEditorWrapColumn(clamp(readInt('gtt:testcases-libs:editor:wrapColumn', 80), 20, 240))

      setAiRulesOnlyDefault(readBool('gtt:ai:libs:useRulesOnly', false))
      setAiMaxLinesDefault(clamp(readInt('gtt:ai:libs:maxLines', 0), 0, 200))
      setAiMaxColDefault(clamp(readInt('gtt:ai:libs:maxCol', 0), 0, 400))
      setDocAiHint(
        readStr(
          'gtt:scenarios:docAiHint',
          '请将说明文档中的用例/检查点拆分成结构化的用户场景列表：每条用例尽量包含 caseCode、UserStory、AcceptanceCriteria、前置条件、测试步骤、预期结果；测试步骤和预期结果建议使用 “1. …；2. …” 的编号格式，并保持一一对应，方便后端直接生成步骤。'
        )
      )

      let cancelled = false

      const loadAi = async () => {
        if (!isAuthenticated) return
        try {
          const res = await fetch('/api/settings/ai', { cache: 'no-store' })
          if (!res.ok) {
            const err = await (async () => {
              try {
                const mod = await import('@/lib/error')
                return mod.normalizeResponseError(res)
              } catch {
                return { message: res.statusText }
              }
            })()
            if (!cancelled) {
              toast.error(err.message || 'Failed to load AI settings')
            }
            return
          }
          const j = await res.json()
          if (cancelled) return
          setAiProvider(normalizeAiProvider(j?.provider))
          setAiModel(j?.model || 'gpt-4o-mini')
          setAiBaseUrl(j?.baseUrl || '')
          setAiHasKey(!!j?.hasApiKey)
          const timeout = Number(j?.timeoutMs ?? 0)
          if (Number.isFinite(timeout)) {
            const normalized = timeout <= 0 ? 0 : clamp(Math.floor(timeout), 0, 600000)
            setAiTimeoutMsValue(normalized)
          } else {
            setAiTimeoutMsValue(10000)
          }
          const maxTokens = Number(j?.maxTokens ?? 0)
          if (Number.isFinite(maxTokens) && maxTokens > 0) {
            setAiMaxTokens(clamp(Math.floor(maxTokens), 64, 512000))
          } else {
            setAiMaxTokens(512)
          }
          if (typeof j?.docAiHint === 'string') {
            setDocAiHint(j.docAiHint)
          }
        } catch (e: any) {
          if (!cancelled) {
            toast.error(e?.message || 'Failed to load AI settings')
          }
        }
      }

      loadAi()
      const loadLogger = async () => {
        if (!isAuthenticated) return
        setLoggerLoading(true)
        try {
          const res = await fetch('/api/settings/logger', { cache: 'no-store' })
          if (cancelled) return
          if (res.status === 403) {
            setLoggerAccessDenied(true)
            setLoggerLoading(false)
            return
          }
          if (!res.ok) {
            const err = await (async () => {
              try {
                const mod = await import('@/lib/error')
                return mod.normalizeResponseError(res)
              } catch {
                return { message: res.statusText }
              }
            })()
            toast.error(err.message || 'Failed to load logger settings')
            setLoggerLoading(false)
            return
          }
          const data = await res.json()
          if (cancelled) return
          const next = {
            filePath: typeof data?.filePath === 'string' ? data.filePath : '',
            fileLevel: (data?.fileLevel ?? 'error') as 'error' | 'warn' | 'tc' | 'info' | 'debug',
            maxSizeMb: Number.isFinite(Number(data?.maxSizeMb))
              ? String(Math.floor(Number(data.maxSizeMb)))
              : '20',
            maxFiles: Number.isFinite(Number(data?.maxFiles))
              ? String(Math.floor(Number(data.maxFiles)))
              : '30',
            zippedArchive: !!data?.zippedArchive,
          }
          setLoggerAccessDenied(false)
          loggerInitialRef.current = next
          setLoggerFilePath(next.filePath)
          setLoggerFileLevel(next.fileLevel)
          setLoggerMaxSizeMbInput(next.maxSizeMb)
          setLoggerMaxFilesInput(next.maxFiles)
          setLoggerZippedArchive(next.zippedArchive)
        } catch (e: any) {
          if (!cancelled) {
            toast.error(e?.message || 'Failed to load logger settings')
          }
        } finally {
          if (!cancelled) {
            setLoggerLoading(false)
          }
        }
      }

      loadLogger()

      // Load Redis connections mapping (front-end defined)
      try {
        const raw = localStorage.getItem('gtt:redis:connections') || ''
        if (raw.trim()) {
          setRedisConnsInput(raw)
          setRedisConnsError(null)
        } else {
          setRedisConnsInput('')
          setRedisConnsError(null)
        }
      } catch {
        setRedisConnsInput('')
        setRedisConnsError(null)
      }

      const loadApiTests = async () => {
        if (!isAuthenticated) return
        try {
          const res = await fetch('/api/settings/api-tests', { cache: 'no-store' })
          if (!res.ok) {
            const err = await (async () => {
              try {
                const mod = await import('@/lib/error')
                return mod.normalizeResponseError(res)
              } catch {
                return { message: res.statusText }
              }
            })()
            if (!cancelled) {
              toast.error(err.message || 'Failed to load API tests settings')
            }
            return
          }
          const data = await res.json()
          if (cancelled) return
          const baseUrl = typeof data?.baseUrl === 'string' ? data.baseUrl : ''
          setApiBaseUrl(baseUrl)
          const headers = data?.defaultHeaders && typeof data.defaultHeaders === 'object'
            ? JSON.stringify(data.defaultHeaders, null, 2)
            : ''
          setApiHeadersInput(headers)
          setApiHeadersError(null)
          const sampleId =
            typeof data?.sampleLivePostId === 'string' ? data.sampleLivePostId : ''
          setApiSampleLivePostId(sampleId)
        } catch (e: any) {
          if (!cancelled) {
            toast.error(e?.message || 'Failed to load API tests settings')
          }
        }
      }

      void loadApiTests()

      return () => {
        cancelled = true
      }
    }, [isAuthenticated])

    const persistLocalSettings = () => {
      localStorage.setItem('gtt:inspector:autoWake', inspectorAutoWake ? '1' : '0')
      localStorage.setItem('gtt:inspector:autoUnlock', inspectorAutoUnlock ? '1' : '0')
      localStorage.setItem('gtt:inspector:unlockPassword', unlockPassword)
      localStorage.setItem('gtt:inspector:unlockSwipe', unlockSwipe)
      localStorage.setItem('gtt:inspector:unlockKeywords', unlockKeywords)
      localStorage.setItem('gtt:inspector:unlockKeywordsPreset', keywordsPresetId)

      localStorage.setItem('gtt:inspector:lists:autoRefresh', inspectorListsAuto ? '1' : '0')
      localStorage.setItem(
        'gtt:inspector:lists:refreshSec',
        String(clamp(inspectorListsSec | 0, 1, 60))
      )

      localStorage.setItem('gtt:testcases:appiumAutoRefresh', tcAppiumAuto ? '1' : '0')
      localStorage.setItem('gtt:testcases-libs:appiumAutoRefresh', libsAppiumAuto ? '1' : '0')
      localStorage.setItem(
        'gtt:testcases-libs:editor:wrapColumn',
        String(clamp(libsEditorWrapColumn | 0, 20, 240))
      )

      localStorage.setItem('gtt:inspector:snapshot:autoRefresh', snapshotAuto ? '1' : '0')
      localStorage.setItem(
        'gtt:inspector:snapshot:intervalMs',
        String(clamp(snapshotMs | 0, 100, 3000))
      )
      localStorage.setItem(
        'gtt:inspector:snapshot:maxAttempts',
        String(clamp(snapshotAttempts | 0, 1, 20))
      )
      localStorage.setItem('gtt:inspector:clickableOnly', inspectorClickableOnly ? '1' : '0')
      localStorage.setItem('gtt:inspector:preferAppiumSource', inspectorPreferAppium ? '1' : '0')
      localStorage.setItem('gtt:inspector:cacheWarmEnabled', inspectorWarmEnabled ? '1' : '0')
      localStorage.setItem('gtt:inspector:cacheTtlMs', String(clamp(inspectorCacheTtl | 0, 1000, 60000)))
      localStorage.setItem('gtt:inspector:overlayMode', inspectorOverlayMode)
      localStorage.setItem('gtt:inspector:fsOnAdbFail', fsOnAdbFail ? '1' : '0')
      localStorage.setItem('gtt:inspector:fsFailN', String(clamp(fsFailN | 0, 1, 10)))
      localStorage.setItem('gtt:inspector:fsCooldownMs', String(clamp(fsCooldownMs | 0, 0, 600000)))

      localStorage.setItem('gtt:ai:libs:useRulesOnly', aiRulesOnlyDefault ? '1' : '0')
      localStorage.setItem(
        'gtt:ai:libs:maxLines',
        String(clamp(Math.floor(aiMaxLinesDefault), 0, 200))
      )
      localStorage.setItem('gtt:ai:libs:maxCol', String(clamp(Math.floor(aiMaxColDefault), 0, 400)))
      localStorage.setItem('gtt:scenarios:docAiHint', docAiHint || '')
      // Redis connections mapping (JSON object: { env: { host, port, tls?, cluster? }, ... })
      try {
        if (redisConnsInput.trim()) {
          const parsed = JSON.parse(redisConnsInput)
          if (parsed && typeof parsed === 'object') {
            localStorage.setItem('gtt:redis:connections', JSON.stringify(parsed))
            setRedisConnsError(null)
          } else {
            setRedisConnsError('Must be a JSON object')
          }
        } else {
          localStorage.removeItem('gtt:redis:connections')
          setRedisConnsError(null)
        }
      } catch (e: any) {
        setRedisConnsError(e?.message || 'Invalid JSON')
      }
    }

    const syncAiSettings = async () => {
      if (!isAuthenticated) return
      const payload: Record<string, unknown> = {
        provider: aiProvider,
        model: aiModel.trim(),
        baseUrl: aiBaseUrl.trim(),
      }
      if (aiApiKeyInput.trim()) payload.apiKey = aiApiKeyInput.trim()
      if (aiClearKey) payload.clearKey = true

      if (Number.isFinite(aiTimeoutMsValue)) {
        const normalized =
          aiTimeoutMsValue <= 0 ? 0 : clamp(Math.floor(aiTimeoutMsValue), 0, 600000)
        payload.timeoutMs = normalized
      }

      if (Number.isFinite(aiMaxTokens)) {
        payload.maxTokens = clamp(Math.floor(aiMaxTokens), 64, 512000)
      }
      payload.docAiHint = docAiHint

      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await (async () => {
          try {
            const mod = await import('@/lib/error')
            return mod.normalizeResponseError(res)
          } catch {
            return { message: res.statusText }
          }
        })()
        throw new Error(err.message || 'Failed to save AI settings')
      }

      const j = await res.json()
      setAiHasKey(!!j?.hasApiKey)
      const returnedTimeout = Number(j?.timeoutMs ?? payload.timeoutMs ?? aiTimeoutMsValue)
      if (Number.isFinite(returnedTimeout)) {
        const normalized = returnedTimeout <= 0 ? 0 : clamp(Math.floor(returnedTimeout), 0, 600000)
        setAiTimeoutMsValue(normalized)
      }
      const returnedMaxTokens = Number(j?.maxTokens ?? payload.maxTokens ?? aiMaxTokens)
      if (Number.isFinite(returnedMaxTokens) && returnedMaxTokens > 0) {
        setAiMaxTokens(clamp(Math.floor(returnedMaxTokens), 64, 512000))
      }
      if (typeof j?.docAiHint === 'string') {
        setDocAiHint(j.docAiHint)
      }
      setAiApiKeyInput('')
      setAiClearKey(false)
    }

    const syncApiTestsSettings = async () => {
      if (!isAuthenticated) return
      const baseUrl = apiBaseUrl.trim()
      if (!baseUrl) {
        throw new Error('API Tests baseUrl is required')
      }
      let headersObj: Record<string, string> | null = null
      if (apiHeadersInput.trim()) {
        try {
          const parsed = JSON.parse(apiHeadersInput)
          if (parsed && typeof parsed === 'object') {
            headersObj = {}
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof k === 'string' && typeof v === 'string') {
                headersObj[k] = v
              }
            }
          } else {
            throw new Error('Default headers must be a JSON object of string:string')
          }
        } catch (e: any) {
          setApiHeadersError(e?.message || 'Invalid headers JSON')
          throw new Error(e?.message || 'Invalid headers JSON')
        }
      }
      const payload: Record<string, unknown> = {
        baseUrl,
      }
      if (headersObj !== null) {
        payload.defaultHeaders = headersObj
      }
      if (apiSampleLivePostId.trim()) {
        payload.sampleLivePostId = apiSampleLivePostId.trim()
      }
      const res = await fetch('/api/settings/api-tests', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await (async () => {
          try {
            const mod = await import('@/lib/error')
            return mod.normalizeResponseError(res)
          } catch {
            return { message: res.statusText }
          }
        })()
        throw new Error(err.message || 'Failed to save API tests settings')
      }
      const data = await res.json()
      setApiBaseUrl(typeof data?.baseUrl === 'string' ? data.baseUrl : baseUrl)
      const headers = data?.defaultHeaders && typeof data.defaultHeaders === 'object'
        ? JSON.stringify(data.defaultHeaders, null, 2)
        : ''
      setApiHeadersInput(headers)
      setApiHeadersError(null)
      const sampleId =
        typeof data?.sampleLivePostId === 'string' ? data.sampleLivePostId : apiSampleLivePostId
      setApiSampleLivePostId(sampleId)
    }

    const syncLoggerSettings = async () => {
      if (!isAuthenticated || loggerAccessDenied) return
      const fallbackSize = Number(loggerInitialRef.current?.maxSizeMb ?? 20)
      const fallbackFiles = Number(loggerInitialRef.current?.maxFiles ?? 30)
      const parsedSize = Number(loggerMaxSizeMbInput)
      const parsedFiles = Number(loggerMaxFilesInput)
      const normalizedSize =
        Number.isFinite(parsedSize) && parsedSize > 0
          ? clamp(Math.floor(parsedSize), 1, 1024)
          : clamp(
              Number.isFinite(fallbackSize) && fallbackSize > 0 ? Math.floor(fallbackSize) : 20,
              1,
              1024
            )
      const normalizedFiles =
        Number.isFinite(parsedFiles) && parsedFiles > 0
          ? clamp(Math.floor(parsedFiles), 1, 200)
          : clamp(
              Number.isFinite(fallbackFiles) && fallbackFiles > 0 ? Math.floor(fallbackFiles) : 30,
              1,
              200
            )
      const payload = {
        filePath: loggerFilePath.trim() || loggerInitialRef.current?.filePath || './logs/app.log',
        fileLevel: loggerFileLevel,
        maxSizeMb: normalizedSize,
        maxFiles: normalizedFiles,
        zippedArchive: loggerZippedArchive,
      }
      const res = await fetch('/api/settings/logger', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 403) {
        setLoggerAccessDenied(true)
        throw new Error('Admin privileges required to update logger settings')
      }
      if (!res.ok) {
        const err = await (async () => {
          try {
            const mod = await import('@/lib/error')
            return mod.normalizeResponseError(res)
          } catch {
            return { message: res.statusText }
          }
        })()
        throw new Error(err.message || 'Failed to save logger settings')
      }
      const data = await res.json()
      const next = {
        filePath: typeof data?.filePath === 'string' ? data.filePath : payload.filePath,
        fileLevel: (data?.fileLevel ?? payload.fileLevel) as
          | 'error'
          | 'warn'
          | 'tc'
          | 'info'
          | 'debug',
        maxSizeMb: Number.isFinite(Number(data?.maxSizeMb))
          ? String(Math.floor(Number(data.maxSizeMb)))
          : String(payload.maxSizeMb),
        maxFiles: Number.isFinite(Number(data?.maxFiles))
          ? String(Math.floor(Number(data.maxFiles)))
          : String(payload.maxFiles),
        zippedArchive:
          data?.zippedArchive === undefined ? payload.zippedArchive : !!data.zippedArchive,
      }
      loggerInitialRef.current = next
      setLoggerFilePath(next.filePath)
      setLoggerFileLevel(next.fileLevel)
      setLoggerMaxSizeMbInput(next.maxSizeMb)
      setLoggerMaxFilesInput(next.maxFiles)
      setLoggerZippedArchive(next.zippedArchive)
    }

    const saveAll = async () => {
      try {
        persistLocalSettings()
        await syncAiSettings()
        await syncLoggerSettings()
        await syncApiTestsSettings()
        toast.success('Settings saved')
        window.dispatchEvent(new Event('gtt-parameters-updated'))
      } catch (e: any) {
        toast.error(e?.message || 'Failed to save settings')
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        save: () => {
          void saveAll()
        },
        reset: () => resetDefaults(),
      }),
      [
        inspectorAutoWake,
        inspectorAutoUnlock,
        unlockPassword,
        unlockSwipe,
        unlockKeywords,
        keywordsPresetId,
        inspectorListsAuto,
        inspectorListsSec,
        snapshotAuto,
        snapshotMs,
        snapshotAttempts,
        tcAppiumAuto,
        libsAppiumAuto,
        libsEditorWrapColumn,
        aiRulesOnlyDefault,
        aiMaxLinesDefault,
        aiMaxColDefault,
        aiProvider,
        aiModel,
        aiBaseUrl,
        aiApiKeyInput,
        aiClearKey,
        aiTimeoutMsValue,
        aiMaxTokens,
        loggerFilePath,
        loggerFileLevel,
        loggerMaxSizeMbInput,
        loggerMaxFilesInput,
        loggerZippedArchive,
        loggerAccessDenied,
        apiBaseUrl,
        apiHeadersInput,
      ]
    )

    const resetDefaults = () => {
      setInspectorAutoWake(true)
      setInspectorAutoUnlock(false)
      setUnlockPassword('')
      setUnlockSwipe('')
      setUnlockKeywords('holding display')
      setKeywordsPresetId('holding-display')

      setInspectorListsAuto(true)
      setInspectorListsSec(3)

      setSnapshotAuto(false)
      setSnapshotMs(1200)
      setSnapshotAttempts(10)
      setInspectorClickableOnly(true)
      setInspectorPreferAppium(false)
      setInspectorWarmEnabled(true)
      setInspectorCacheTtl(15000)
      setInspectorOverlayMode('boxes')
      setFsOnAdbFail(false)
      setFsFailN(2)
      setFsCooldownMs(60000)

      setTcAppiumAuto(true)
      setLibsAppiumAuto(true)
      setLibsEditorWrapColumn(80)

      setAiRulesOnlyDefault(false)
      setAiMaxLinesDefault(0)
      setAiMaxColDefault(0)

      setAiTimeoutMsValue(10000)
      setAiMaxTokens(512)

      setAiProvider('openai')
      setAiModel('gpt-4o-mini')
      setAiBaseUrl('')
      setAiApiKeyInput('')
      setAiClearKey(false)

      const base = loggerInitialRef.current
      if (base) {
        setLoggerFilePath(base.filePath)
        setLoggerFileLevel(base.fileLevel)
        setLoggerMaxSizeMbInput(base.maxSizeMb)
        setLoggerMaxFilesInput(base.maxFiles)
        setLoggerZippedArchive(base.zippedArchive)
      } else {
        setLoggerFilePath('')
        setLoggerFileLevel('error')
        setLoggerMaxSizeMbInput('20')
        setLoggerMaxFilesInput('30')
        setLoggerZippedArchive(true)
      }
    }

    const baseUrlPlaceholder =
      aiProvider === 'grok' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1'

    return (
      <div className="flex w-full flex-1 flex-col gap-4 p-3 lg:p-4">
        <div className="grid gap-4 xl:grid-cols-[2.1fr,1fr]">
          <div className="flex flex-col gap-4">
            <Section
              title="Redis Connections"
              description="Front-end presets for Redis environments. Define a JSON map, then use it from Redis Control."
            >
              <div className="space-y-3">
                <div>
                  <p className="text-muted-foreground text-xs">
                    JSON object: {'{'} "envName": {'{'} host, port, tls?, cluster? {'}'} {'}'}
                  </p>
                  <p className="text-muted-foreground text-xs">Example:</p>
                  <pre className="bg-muted max-h-40 overflow-auto rounded-md border p-2 text-xs">
                    {`{
  "qa1-corebe": {
    "host": "abc-qa-core-be-redis-qa1.cu5ewp.clustercfg.use1.cache.amazonaws.com",
    "port": 6379,
    "tls": true,
    "cluster": true
  },
  "qa4-corebe": {
    "host": "abc-qa-core-be-redis-qa4.cu5ewp.clustercfg.use1.cache.amazonaws.com",
    "port": 6379,
    "tls": true,
    "cluster": true
  }
}`}
                  </pre>
                </div>
                <div>
                  <Label htmlFor="redis-connections" className="text-sm font-medium">
                    Connections JSON
                  </Label>
                  <textarea
                    id="redis-connections"
                    className={cn(
                      'mt-1 h-40 w-full resize-y rounded-md border p-2 font-mono text-xs',
                      redisConnsError ? 'border-destructive' : ''
                    )}
                    placeholder={
                      '{\n  "env": { "host": "...", "port": 6379, "tls": true, "cluster": true }\n}'
                    }
                    value={redisConnsInput}
                    onChange={(e) => setRedisConnsInput(e.target.value)}
                  />
                  {redisConnsError ? (
                    <p className="text-destructive mt-1 text-xs">{redisConnsError}</p>
                  ) : (
                    <p className="text-muted-foreground mt-1 text-xs">Leave empty to clear</p>
                  )}
                </div>
              </div>
            </Section>
            <Section
              title="Inspector"
              description="Control snapshot automation and Android device polling."
            >
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-foreground text-sm font-medium">Snapshot unlock &amp; wake</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="ins-auto-wake"
                        checked={inspectorAutoWake}
                        onCheckedChange={(v) => setInspectorAutoWake(!!v)}
                      />
                      <Label htmlFor="ins-auto-wake" className="cursor-pointer text-xs select-none">
                        Auto wake on failure
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="ins-auto-unlock"
                        checked={inspectorAutoUnlock}
                        onCheckedChange={(v) => setInspectorAutoUnlock(!!v)}
                      />
                      <Label
                        htmlFor="ins-auto-unlock"
                        className="cursor-pointer text-xs select-none"
                      >
                        Auto unlock before snapshot
                      </Label>
                    </div>
                    <Input
                      type="password"
                      className="h-8 w-48"
                      placeholder="Password (optional)"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                    />
                    <Input
                      className="h-8 w-56"
                      placeholder="Swipe: x1 y1 x2 y2"
                      value={unlockSwipe}
                      onChange={(e) => setUnlockSwipe(e.target.value)}
                    />
                    <Input
                      className="h-8 w-56"
                      placeholder="Keywords (e.g. holding display)"
                      value={unlockKeywords}
                      onChange={(e) => setUnlockKeywords(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="ins-keywords-preset"
                        className="text-muted-foreground text-xs"
                      >
                        Preset
                      </Label>
                      <Select
                        value={keywordsPresetId}
                        onValueChange={(v) => {
                          setKeywordsPresetId(v)
                          const p = keywordPresets.find((x) => x.id === v)
                          if (p) setUnlockKeywords(p.value)
                        }}
                      >
                        <SelectTrigger id="ins-keywords-preset" className="h-8 w-[220px]">
                          <SelectValue placeholder="Keyword presets" />
                        </SelectTrigger>
                        <SelectContent>
                          {keywordPresets.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Custom (use input)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-foreground text-sm font-medium">Snapshot auto refresh</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="ins-snapshot-auto"
                        checked={snapshotAuto}
                        onCheckedChange={(v) => setSnapshotAuto(!!v)}
                      />
                      <Label
                        htmlFor="ins-snapshot-auto"
                        className="cursor-pointer text-xs select-none"
                      >
                        Enable
                      </Label>
                    </div>
                    <Label htmlFor="ins-snapshot-ms" className="text-muted-foreground text-xs">
                      Interval
                    </Label>
                    <Input
                      id="ins-snapshot-ms"
                      type="number"
                      min={100}
                      max={3000}
                      className="h-8 w-24"
                      value={snapshotMs}
                      onChange={(e) =>
                        setSnapshotMs(clamp(parseInt(e.target.value || '400', 10), 100, 3000))
                      }
                    />
                    <span className="text-muted-foreground text-xs">ms</span>
                    <Label
                      htmlFor="ins-snapshot-attempts"
                      className="text-muted-foreground text-xs"
                    >
                      Attempts
                    </Label>
                    <Input
                      id="ins-snapshot-attempts"
                      type="number"
                      min={1}
                      max={20}
                      className="h-8 w-20"
                      value={snapshotAttempts}
                      onChange={(e) =>
                        setSnapshotAttempts(clamp(parseInt(e.target.value || '6', 10), 1, 20))
                      }
                    />
                  </div>
                </div>

              <div className="space-y-3">
                <p className="text-foreground text-sm font-medium">Device list refresh</p>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="ins-lists-auto"
                        checked={inspectorListsAuto}
                        onCheckedChange={(v) => setInspectorListsAuto(!!v)}
                      />
                      <Label
                        htmlFor="ins-lists-auto"
                        className="cursor-pointer text-xs select-none"
                      >
                        Lists auto refresh
                      </Label>
                    </div>
                    <Label htmlFor="ins-lists-sec" className="text-muted-foreground text-xs">
                      Interval
                    </Label>
                    <Input
                      id="ins-lists-sec"
                      type="number"
                      min={1}
                      max={60}
                      step={1}
                      className="h-8 w-20"
                      value={inspectorListsSec}
                      onChange={(e) =>
                        setInspectorListsSec(clamp(parseInt(e.target.value || '3', 10), 1, 60))
                      }
                    />
                    <span className="text-muted-foreground text-xs">s</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-foreground text-sm font-medium">Warm cache</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ins-cache-enabled"
                      checked={inspectorWarmEnabled}
                      onCheckedChange={(v) => setInspectorWarmEnabled(!!v)}
                    />
                    <Label htmlFor="ins-cache-enabled" className="cursor-pointer text-xs select-none">
                      Enable
                    </Label>
                  </div>
                  <Label htmlFor="ins-cache-ttl" className="text-muted-foreground text-xs">
                    Snapshot cache TTL
                  </Label>
                  <Input
                    id="ins-cache-ttl"
                    type="number"
                    min={1000}
                    max={60000}
                    step={500}
                    className="h-8 w-28"
                    value={inspectorCacheTtl}
                    disabled={!inspectorWarmEnabled}
                    onChange={(e) =>
                      setInspectorCacheTtl(
                        clamp(parseInt(e.target.value || '15000', 10), 1000, 60000)
                      )
                    }
                  />
                  <span className="text-muted-foreground text-xs">ms</span>
                  <div className="text-muted-foreground text-xs">
                    Used for cross-page warm start. Lower to reduce staleness.
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-foreground text-sm font-medium">Overlay &amp; filters</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ins-overlay-clickable-only"
                      checked={inspectorClickableOnly}
                      onCheckedChange={(v) => setInspectorClickableOnly(!!v)}
                    />
                    <Label
                      htmlFor="ins-overlay-clickable-only"
                      className="cursor-pointer text-xs select-none"
                    >
                      Clickable only
                    </Label>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Applies to Inspector and Libs overlay.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="ins-overlay-mode" className="text-muted-foreground text-xs">
                    Overlay mode
                  </Label>
                  <Select
                    value={inspectorOverlayMode}
                    onValueChange={(v) => setInspectorOverlayMode(v as 'boxes' | 'markers')}
                  >
                    <SelectTrigger id="ins-overlay-mode" className="h-8 w-44">
                      <SelectValue placeholder="Overlay mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boxes">Boxes (default)</SelectItem>
                      <SelectItem value="markers">Markers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ins-prefer-appium"
                      checked={inspectorPreferAppium}
                      onCheckedChange={(v) => setInspectorPreferAppium(!!v)}
                    />
                    <Label
                      htmlFor="ins-prefer-appium"
                      className="cursor-pointer text-xs select-none"
                    >
                      Use Appium pageSource (faster; may hang under load)
                    </Label>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Fallback to ADB dump on failure.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ins-fs-on-adb-fail"
                      checked={fsOnAdbFail}
                      onCheckedChange={(v) => setFsOnAdbFail(!!v)}
                    />
                    <Label
                      htmlFor="ins-fs-on-adb-fail"
                      className="cursor-pointer text-xs select-none"
                    >
                      If ADB dump fails consecutively, force-stop UiAutomator2
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ins-fs-failN" className="text-muted-foreground text-xs">
                      Threshold
                    </Label>
                    <Input
                      id="ins-fs-failN"
                      type="number"
                      min={1}
                      max={10}
                      className="h-8 w-20"
                      value={fsFailN}
                      onChange={(e) =>
                        setFsFailN(clamp(parseInt(e.target.value || '2', 10), 1, 10))
                      }
                    />
                    <Label htmlFor="ins-fs-cooldown" className="text-muted-foreground text-xs">
                      Cooldown
                    </Label>
                    <Input
                      id="ins-fs-cooldown"
                      type="number"
                      min={0}
                      max={600000}
                      step={5000}
                      className="h-8 w-28"
                      value={fsCooldownMs}
                      onChange={(e) =>
                        setFsCooldownMs(clamp(parseInt(e.target.value || '60000', 10), 0, 600000))
                      }
                    />
                    <span className="text-muted-foreground text-xs">ms</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="Testcases & Libs"
              description="Shared Appium polling and editor preferences."
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="tc-appium-auto"
                      checked={tcAppiumAuto}
                      onCheckedChange={(v) => setTcAppiumAuto(!!v)}
                    />
                    <Label htmlFor="tc-appium-auto" className="cursor-pointer text-xs select-none">
                      Testcases Appium auto refresh
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="libs-appium-auto"
                      checked={libsAppiumAuto}
                      onCheckedChange={(v) => setLibsAppiumAuto(!!v)}
                    />
                    <Label
                      htmlFor="libs-appium-auto"
                      className="cursor-pointer text-xs select-none"
                    >
                      Libs Appium auto refresh
                    </Label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="libs-editor-wrap" className="text-muted-foreground text-xs">
                    Libs editor wrap column
                  </Label>
                  <Input
                    id="libs-editor-wrap"
                    type="number"
                    min={20}
                    max={240}
                    step={1}
                    className="h-8 w-24"
                    value={libsEditorWrapColumn}
                    onChange={(e) =>
                      setLibsEditorWrapColumn(clamp(parseInt(e.target.value || '80', 10), 20, 240))
                    }
                  />
                  <span className="text-muted-foreground text-xs">chars</span>
                </div>
              </div>
            </Section>

            <Section title="AI Defaults" description="Initial values for the Libs AI helper.">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ai-rules-only"
                      checked={aiRulesOnlyDefault}
                      onCheckedChange={(v) => setAiRulesOnlyDefault(!!v)}
                    />
                    <Label htmlFor="ai-rules-only" className="cursor-pointer text-xs select-none">
                      Use rule-only prompt by default
                    </Label>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai-max-lines" className="text-muted-foreground text-xs">
                      Max lines
                    </Label>
                    <Input
                      id="ai-max-lines"
                      type="number"
                      min={0}
                      max={200}
                      step={1}
                      className="h-8 w-20"
                      value={aiMaxLinesDefault}
                      onChange={(e) => {
                        const n = parseInt(e.target.value || '0', 10)
                        if (!Number.isFinite(n)) {
                          setAiMaxLinesDefault(0)
                        } else {
                          setAiMaxLinesDefault(clamp(n, 0, 200))
                        }
                      }}
                      placeholder="0"
                    />
                    <span className="text-muted-foreground text-xs">0 = unlimited</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai-max-col" className="text-muted-foreground text-xs">
                      Max column
                    </Label>
                    <Input
                      id="ai-max-col"
                      type="number"
                      min={0}
                      max={400}
                      step={1}
                      className="h-8 w-24"
                      value={aiMaxColDefault}
                      onChange={(e) => {
                        const n = parseInt(e.target.value || '0', 10)
                        if (!Number.isFinite(n)) {
                          setAiMaxColDefault(0)
                        } else {
                          setAiMaxColDefault(clamp(n, 0, 400))
                        }
                      }}
                      placeholder="0"
                    />
                    <span className="text-muted-foreground text-xs">0 = unlimited</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="User Scenario Doc Parsing"
              description="Default hint for converting specification/markdown docs into user scenarios."
            >
              <div className="space-y-2">
                <Label htmlFor="ai-doc-hint" className="text-muted-foreground text-xs">
                  Default AI hint for user-scenario ingest
                </Label>
                <Textarea
                  id="ai-doc-hint"
                  rows={5}
                  value={docAiHint}
                  onChange={(e) => setDocAiHint(e.target.value)}
                  placeholder="例如：说明如何从设计文档中识别 caseCode、模块、前置条件、测试步骤和预期结果，以及拆分粒度与命名约定。"
                />
                <p className="text-muted-foreground text-[11px]">
                  Scenarios 页面在从说明文档/设计文档导入用户场景时，会默认带上这里的提示，并允许在弹出的对话框中临时修改。
                </p>
              </div>
            </Section>

            <Section title="AI Backend" description="Server-side LLM provider configuration.">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai-provider" className="text-muted-foreground text-xs">
                      Provider
                    </Label>
                    <Select
                      value={aiProvider}
                      onValueChange={(value) => setAiProvider(normalizeAiProvider(value))}
                    >
                      <SelectTrigger id="ai-provider" className="h-8 w-[220px]">
                        <SelectValue placeholder="Choose provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="azure">Azure OpenAI</SelectItem>
                        <SelectItem value="grok">Grok (xAI)</SelectItem>
                        <SelectItem value="custom">OpenAI-compatible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai-model" className="text-muted-foreground text-xs">
                      Model / deployment
                    </Label>
                    <Input
                      id="ai-model"
                      className="h-8 w-56"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="gpt-4o-mini"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="ai-base-url" className="text-muted-foreground text-xs">
                    Base URL
                  </Label>
                  <Input
                    id="ai-base-url"
                    className="h-8 w-[360px]"
                    value={aiBaseUrl}
                    onChange={(e) => setAiBaseUrl(e.target.value)}
                    placeholder={baseUrlPlaceholder}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai-timeout" className="text-muted-foreground text-xs">
                      Timeout (ms)
                    </Label>
                    <Input
                      id="ai-timeout"
                      type="number"
                      min={0}
                      max={600000}
                      step={500}
                      className="h-8 w-28"
                      value={aiTimeoutMsValue}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value || '0', 10)
                        if (!Number.isFinite(raw)) {
                          setAiTimeoutMsValue(0)
                        } else {
                          setAiTimeoutMsValue(clamp(Math.floor(raw), 0, 600000))
                        }
                      }}
                    />
                    <span className="text-muted-foreground text-xs">0 = no timeout</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ai-max-tokens" className="text-muted-foreground text-xs">
                      Max output tokens
                    </Label>
                    <Input
                      id="ai-max-tokens"
                      type="number"
                      min={64}
                      max={512000}
                      step={256}
                      className="h-8 w-[160px]"
                      value={aiMaxTokens}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (!Number.isFinite(val)) {
                          setAiMaxTokens(512)
                        } else {
                          setAiMaxTokens(clamp(Math.floor(val), 64, 512000))
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="ai-key" className="text-muted-foreground text-xs">
                    API key
                  </Label>
                  <Input
                    id="ai-key"
                    type="password"
                    className="h-8 w-[360px]"
                    value={aiApiKeyInput}
                    onChange={(e) => setAiApiKeyInput(e.target.value)}
                    placeholder={aiHasKey ? '******** (set to replace)' : 'sk-...'}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ai-clear-key"
                      checked={aiClearKey}
                      onCheckedChange={(v) => setAiClearKey(!!v)}
                    />
                    <Label htmlFor="ai-clear-key" className="cursor-pointer text-xs select-none">
                      Clear saved key
                    </Label>
                  </div>
                </div>
              </div>
            </Section>

            <Section
              title="API Tests"
              description="Configure API test base URL and default headers used by generated *.api.test.ts cases."
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="api-base-url">Base URL</Label>
                  <Input
                    id="api-base-url"
                    placeholder="https://api.example.com"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    例如：<code>https://qa1-prod.gettr-qa.com/api</code>。生成的测试会在此基础上拼接各个 Path。
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="api-headers">Default Headers (JSON)</Label>
                  <textarea
                    id="api-headers"
                    className={cn(
                      'min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono',
                      apiHeadersError ? 'border-destructive' : '',
                    )}
                    placeholder={`{\n  "Authorization": "Bearer xxx",\n  "x-app-env": "qa1"\n}`}
                    value={apiHeadersInput}
                    onChange={(e) => {
                      setApiHeadersInput(e.target.value)
                      setApiHeadersError(null)
                    }}
                  />
                  {apiHeadersError ? (
                    <p className="text-xs text-destructive mt-1">{apiHeadersError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      可选：JSON 对象，键和值必须都是字符串。留空表示不设置默认 Header。
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="api-sample-live-id">Sample live postId</Label>
                  <Input
                    id="api-sample-live-id"
                    placeholder="e.g. live_post_id_for_testing"
                    value={apiSampleLivePostId}
                    onChange={(e) => setApiSampleLivePostId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    可选：用于示例测试中访问 <code>/u/live/stream/&lt;id&gt;</code> 和{' '}
                    <code>/u/live/chat/&lt;id&gt;</code> 的 sample postId。
                    留空则示例中会提示手动替换。
                  </p>
                </div>
              </div>
            </Section>

            <Section
              title="Logger"
              description="Configure server log rotation. Admin access is required to view or modify these settings."
            >
              {loggerAccessDenied ? (
                <p className="text-muted-foreground text-sm">
                  Admin privileges are required to manage logger settings.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Label htmlFor="logger-file-path" className="text-muted-foreground text-xs">
                      Log file path
                    </Label>
                    <Input
                      id="logger-file-path"
                      className="h-8 w-[360px]"
                      value={loggerFilePath}
                      onChange={(e) => setLoggerFilePath(e.target.value)}
                      placeholder="./logs/app.log"
                      disabled={loggerLoading}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="logger-file-level" className="text-muted-foreground text-xs">
                        File level
                      </Label>
                      <Select
                        value={loggerFileLevel}
                        onValueChange={(value) =>
                          setLoggerFileLevel(
                            (value as 'error' | 'warn' | 'tc' | 'info' | 'debug') ?? 'error'
                          )
                        }
                        disabled={loggerLoading}
                      >
                        <SelectTrigger id="logger-file-level" className="h-8 w-[160px]">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="error">error</SelectItem>
                          <SelectItem value="warn">warn</SelectItem>
                          <SelectItem value="tc">tc</SelectItem>
                          <SelectItem value="info">info</SelectItem>
                          <SelectItem value="debug">debug</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="logger-max-size" className="text-muted-foreground text-xs">
                        Max size (MB)
                      </Label>
                      <Input
                        id="logger-max-size"
                        type="number"
                        min={1}
                        max={1024}
                        step={1}
                        className="h-8 w-24"
                        value={loggerMaxSizeMbInput}
                        onChange={(e) => setLoggerMaxSizeMbInput(e.target.value)}
                        disabled={loggerLoading}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="logger-max-files" className="text-muted-foreground text-xs">
                        Max files
                      </Label>
                      <Input
                        id="logger-max-files"
                        type="number"
                        min={1}
                        max={200}
                        step={1}
                        className="h-8 w-24"
                        value={loggerMaxFilesInput}
                        onChange={(e) => setLoggerMaxFilesInput(e.target.value)}
                        disabled={loggerLoading}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="logger-zipped" className="text-muted-foreground text-xs">
                        Zip archives
                      </Label>
                      <Switch
                        id="logger-zipped"
                        checked={loggerZippedArchive}
                        onCheckedChange={(v) => setLoggerZippedArchive(!!v)}
                        disabled={loggerLoading}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Section>
          </div>

          <Section title="Help" className="h-fit" description="快速回顾常用字段的含义与获取方式。">
            <div className="text-muted-foreground space-y-3 text-xs">
              <p>如何获取 Password / Swipe / Keywords：</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <span className="text-foreground font-medium">Password</span>
                  ：锁屏 PIN/密码（图案或无密码可留空）。
                </li>
                <li>
                  <span className="text-foreground font-medium">Swipe</span>
                  ：解锁滑动手势，格式 <code>x1 y1 x2 y2</code>（像素）。可用 Inspector
                  获取坐标或参考截图估算。
                </li>
                <li>
                  <span className="text-foreground font-medium">Keywords</span>
                  ：用于识别“屏幕已点亮/设备已唤醒”的文本，来自 <code>
                    adb shell dumpsys power
                  </code>{' '}
                  输出。例如：
                  <code className="ml-1">holding display</code>、
                  <code className="ml-1">Display Power: state=ON</code>、
                  <code className="ml-1">mWakefulness=Awake</code>、
                  <code className="ml-1">mScreenOn=true</code>。 若系统输出不同，请在命令行执行{' '}
                  <code>adb shell dumpsys power</code> 后选择适配的片段填入。
                </li>
              </ul>
            </div>
          </Section>
        </div>

        {!hideActions && (
          <div className="flex gap-2">
            <Button onClick={() => void saveAll()}>Save</Button>
            <Button variant="outline" onClick={resetDefaults}>
              Reset
            </Button>
          </div>
        )}
      </div>
    )
  }
)
