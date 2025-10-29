'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

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
    return localStorage.getItem(key) ?? def
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

export type ParametersFormHandle = {
  save: () => void
  reset: () => void
}

export type ParametersFormProps = {
  hideActions?: boolean
}

export const ParametersForm = forwardRef<ParametersFormHandle, ParametersFormProps>(function ParametersForm(
  { hideActions = false },
  ref
) {
  // Inspector - Snapshot unlock/wake
  const [inspectorAutoWake, setInspectorAutoWake] = useState(true)
  const [inspectorAutoUnlock, setInspectorAutoUnlock] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockSwipe, setUnlockSwipe] = useState('')
  const [unlockKeywords, setUnlockKeywords] = useState('holding display')
  const keywordPresets = useMemo(
    () => [
      { id: 'holding-display', label: 'holding display', value: 'holding display' },
      { id: 'display-on', label: 'Display Power: state=ON', value: 'Display Power: state=ON' },
      { id: 'awake', label: 'mWakefulness=Awake', value: 'mWakefulness=Awake' },
      { id: 'screen-on', label: 'mScreenOn=true', value: 'mScreenOn=true' },
      { id: 'suspend-blocker', label: 'mHoldingDisplaySuspendBlocker=true', value: 'mHoldingDisplaySuspendBlocker=true' },
    ],
    []
  )
  const [keywordsPresetId, setKeywordsPresetId] = useState('holding-display')

  // Inspector - list refresh (emulators/devices) & Appium polling reuse
  const [inspectorListsAuto, setInspectorListsAuto] = useState(true)
  const [inspectorListsSec, setInspectorListsSec] = useState(3)

  // Inspector - Snapshot auto refresh
  const [snapshotAuto, setSnapshotAuto] = useState(false)
  const [snapshotMs, setSnapshotMs] = useState(400)
  const [snapshotAttempts, setSnapshotAttempts] = useState(6)

  // Testcases & Libs - Appium polling
  const [tcAppiumAuto, setTcAppiumAuto] = useState(true)
  const [libsAppiumAuto, setLibsAppiumAuto] = useState(true)
  const [libsEditorWrapColumn, setLibsEditorWrapColumn] = useState(80)

  // Load from localStorage on mount
  useEffect(() => {
    setInspectorAutoWake(readBool('gtt:inspector:autoWake', true))
    setInspectorAutoUnlock(readBool('gtt:inspector:autoUnlock', false))
    setUnlockPassword(readStr('gtt:inspector:unlockPassword', ''))
    setUnlockSwipe(readStr('gtt:inspector:unlockSwipe', ''))
    setUnlockKeywords(readStr('gtt:inspector:unlockKeywords', 'holding display'))
    setKeywordsPresetId(readStr('gtt:inspector:unlockKeywordsPreset', 'holding-display'))

    setInspectorListsAuto(readBool('gtt:inspector:lists:autoRefresh', true))
    setInspectorListsSec(Math.max(1, Math.min(60, readInt('gtt:inspector:lists:refreshSec', 3))))

    setSnapshotAuto(readBool('gtt:inspector:snapshot:autoRefresh', false))
    setSnapshotMs(Math.max(100, Math.min(3000, readInt('gtt:inspector:snapshot:intervalMs', 400))))
    setSnapshotAttempts(Math.max(1, Math.min(20, readInt('gtt:inspector:snapshot:maxAttempts', 6))))

    setTcAppiumAuto(readBool('gtt:testcases:appiumAutoRefresh', true))
    setLibsAppiumAuto(readBool('gtt:testcases-libs:appiumAutoRefresh', true))
    setLibsEditorWrapColumn(Math.max(20, Math.min(240, readInt('gtt:testcases-libs:editor:wrapColumn', 80))))
  }, [])

  const saveAll = () => {
    try {
      localStorage.setItem('gtt:inspector:autoWake', inspectorAutoWake ? '1' : '0')
      localStorage.setItem('gtt:inspector:autoUnlock', inspectorAutoUnlock ? '1' : '0')
      localStorage.setItem('gtt:inspector:unlockPassword', unlockPassword)
      localStorage.setItem('gtt:inspector:unlockSwipe', unlockSwipe)
      localStorage.setItem('gtt:inspector:unlockKeywords', unlockKeywords)
      localStorage.setItem('gtt:inspector:unlockKeywordsPreset', keywordsPresetId)

      localStorage.setItem('gtt:inspector:lists:autoRefresh', inspectorListsAuto ? '1' : '0')
      localStorage.setItem('gtt:inspector:lists:refreshSec', String(Math.max(1, Math.min(60, inspectorListsSec | 0))))

      localStorage.setItem('gtt:testcases:appiumAutoRefresh', tcAppiumAuto ? '1' : '0')
      localStorage.setItem('gtt:testcases-libs:appiumAutoRefresh', libsAppiumAuto ? '1' : '0')
      localStorage.setItem('gtt:testcases-libs:editor:wrapColumn', String(Math.max(20, Math.min(240, libsEditorWrapColumn | 0))))

      localStorage.setItem('gtt:inspector:snapshot:autoRefresh', snapshotAuto ? '1' : '0')
      localStorage.setItem('gtt:inspector:snapshot:intervalMs', String(Math.max(100, Math.min(3000, snapshotMs | 0))))
      localStorage.setItem('gtt:inspector:snapshot:maxAttempts', String(Math.max(1, Math.min(20, snapshotAttempts | 0))))

      toast.success('Settings saved')
      try { window.dispatchEvent(new Event('gtt-parameters-updated')) } catch {}
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save settings')
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      save: () => saveAll(),
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

    setTcAppiumAuto(true)
    setLibsAppiumAuto(true)
    setLibsEditorWrapColumn(80)

    setSnapshotAuto(false)
    setSnapshotMs(400)
    setSnapshotAttempts(6)
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-2">
      <div className="rounded-lg border p-3">
        <div className="mb-2 text-lg font-semibold">Inspector</div>
        <div className="mb-2 text-sm font-medium">Snapshot</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="ins-auto-wake" checked={inspectorAutoWake} onCheckedChange={(v) => setInspectorAutoWake(!!v)} />
            <Label htmlFor="ins-auto-wake" className="cursor-pointer select-none text-xs">
              Auto wake on failure
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ins-auto-unlock" checked={inspectorAutoUnlock} onCheckedChange={(v) => setInspectorAutoUnlock(!!v)} />
            <Label htmlFor="ins-auto-unlock" className="cursor-pointer select-none text-xs">
              Auto unlock before snapshot
            </Label>
          </div>
          <Input type="password" className="h-8 w-48" placeholder="Password (optional)" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} />
          <Input className="h-8 w-56" placeholder="Swipe: x1 y1 x2 y2" value={unlockSwipe} onChange={(e) => setUnlockSwipe(e.target.value)} />
          <Input className="h-8 w-56" placeholder="Keywords (e.g., holding display)" value={unlockKeywords} onChange={(e) => setUnlockKeywords(e.target.value)} />
          <Select value={keywordsPresetId} onValueChange={(v) => { setKeywordsPresetId(v); const p = keywordPresets.find((x) => x.id === v); if (p) setUnlockKeywords(p.value) }}>
            <SelectTrigger className="h-8 w-[240px]"><SelectValue placeholder="Keyword presets" /></SelectTrigger>
            <SelectContent>
              {keywordPresets.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
              <SelectItem value="custom">Custom (use input)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 mb-2 text-sm font-medium">Snapshot auto refresh</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="ins-snapshot-auto" checked={snapshotAuto} onCheckedChange={(v) => setSnapshotAuto(!!v)} />
            <Label htmlFor="ins-snapshot-auto" className="cursor-pointer select-none text-xs">Enable</Label>
          </div>
          <Label htmlFor="ins-snapshot-ms" className="text-muted-foreground text-xs">Interval</Label>
          <Input id="ins-snapshot-ms" type="number" min={100} max={3000} className="h-8 w-24" value={snapshotMs} onChange={(e) => setSnapshotMs(Math.max(100, Math.min(3000, parseInt(e.target.value || '400', 10))))} />
          <span className="text-xs text-muted-foreground">ms</span>
          <Label htmlFor="ins-snapshot-attempts" className="text-muted-foreground text-xs">Attempts</Label>
          <Input id="ins-snapshot-attempts" type="number" min={1} max={20} className="h-8 w-20" value={snapshotAttempts} onChange={(e) => setSnapshotAttempts(Math.max(1, Math.min(20, parseInt(e.target.value || '6', 10))))} />
        </div>
        <div className="mt-3 mb-2 text-sm font-medium">Emulator/Device list & Appium polling</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="ins-lists-auto" checked={inspectorListsAuto} onCheckedChange={(v) => setInspectorListsAuto(!!v)} />
            <Label htmlFor="ins-lists-auto" className="cursor-pointer select-none text-xs">Lists auto refresh</Label>
          </div>
          <Label htmlFor="ins-lists-sec" className="text-xs text-muted-foreground">Interval</Label>
          <Input id="ins-lists-sec" type="number" min={1} max={60} step={1} className="h-8 w-16" value={inspectorListsSec} onChange={(e) => setInspectorListsSec(Math.max(1, Math.min(60, parseInt(e.target.value || '3', 10))))} />
          <span className="text-xs text-muted-foreground">s</span>
        </div>
      </div>

      {/* Read-only help section */}
      <div className="rounded-lg border p-3 bg-muted/30">
        <div className="mb-2 text-lg font-semibold">Help</div>
        <div className="text-xs text-muted-foreground space-y-2">
          <p>如何获取 Password / Swipe / Keywords：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="font-medium text-foreground">Password</span>：锁屏 PIN/密码（图案或无密码可留空）。
            </li>
            <li>
              <span className="font-medium text-foreground">Swipe</span>：解锁滑动手势，格式 <code>x1 y1 x2 y2</code>（像素）。可用 Inspector 获取坐标或参考截图估算。
            </li>
            <li>
              <span className="font-medium text-foreground">Keywords</span>：用于识别“屏幕已点亮/设备已唤醒”的文本，来自 <code>adb shell dumpsys power</code> 输出。例如：
              <code className="ml-1">holding display</code>、<code className="ml-1">Display Power: state=ON</code>、<code className="ml-1">mWakefulness=Awake</code>、<code className="ml-1">mScreenOn=true</code>。
              若系统输出不同，请在命令行执行 <code>adb shell dumpsys power</code> 后选择适配的片段填入。
            </li>
          </ul>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 text-lg font-semibold">Testcases</div>
        <div className="flex items-center gap-2">
          <Switch id="tc-appium-auto" checked={tcAppiumAuto} onCheckedChange={(v) => setTcAppiumAuto(!!v)} />
          <Label htmlFor="tc-appium-auto" className="cursor-pointer select-none text-xs">Appium auto refresh</Label>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 text-lg font-semibold">Libs</div>
        <div className="flex items-center gap-2">
          <Switch id="libs-appium-auto" checked={libsAppiumAuto} onCheckedChange={(v) => setLibsAppiumAuto(!!v)} />
          <Label htmlFor="libs-appium-auto" className="cursor-pointer select-none text-xs">Appium auto refresh</Label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Label htmlFor="libs-editor-wrap" className="text-xs text-muted-foreground">Editor wrap column</Label>
          <Input
            id="libs-editor-wrap"
            type="number"
            min={20}
            max={240}
            step={1}
            className="h-8 w-24"
            value={libsEditorWrapColumn}
            onChange={(e) => setLibsEditorWrapColumn(Math.max(20, Math.min(240, parseInt(e.target.value || '80', 10))))}
          />
          <span className="text-xs text-muted-foreground">chars</span>
        </div>
      </div>

      {!hideActions && (
        <div className="flex gap-2">
          <Button onClick={saveAll}>Save</Button>
          <Button variant="outline" onClick={resetDefaults}>Reset</Button>
        </div>
      )}
    </div>
  )
})
