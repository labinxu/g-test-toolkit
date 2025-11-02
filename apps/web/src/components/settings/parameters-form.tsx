'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useSession } from '@/app/context/session-context';
import { cn } from '@/lib/utils';

export type ParametersFormHandle = {
  save: () => void;
  reset: () => void;
};

export type ParametersFormProps = {
  hideActions?: boolean;
};

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

function Section({
  title,
  description,
  children,
  className,
  bodyClassName,
}: SectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      <header className="border-b px-4 py-3">
        <h2 className="text-base font-semibold leading-6">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className={cn('px-4 py-4 space-y-6', bodyClassName)}>{children}</div>
    </section>
  );
}

function readBool(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return def;
    return v === '1' || v === 'true';
  } catch {
    return def;
  }
}

function readStr(key: string, def: string): string {
  try {
    const v = localStorage.getItem(key);
    return v == null ? def : v;
  } catch {
    return def;
  }
}

function readInt(key: string, def: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : def;
  } catch {
    return def;
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type AiProvider = 'openai' | 'azure' | 'custom' | 'grok';

const normalizeAiProvider = (value: string | null | undefined): AiProvider => {
  const normalized = (value || '').toLowerCase();
  return normalized === 'azure' ||
    normalized === 'custom' ||
    normalized === 'grok'
    ? (normalized as AiProvider)
    : 'openai';
};

export const ParametersForm = forwardRef<
  ParametersFormHandle,
  ParametersFormProps
>(function ParametersForm({ hideActions = false }, ref) {
  const { isAuthenticated } = useSession();

  // Inspector - Snapshot unlock/wake
  const [inspectorAutoWake, setInspectorAutoWake] = useState(true);
  const [inspectorAutoUnlock, setInspectorAutoUnlock] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockSwipe, setUnlockSwipe] = useState('');
  const [unlockKeywords, setUnlockKeywords] = useState('holding display');

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
    [],
  );

  const [keywordsPresetId, setKeywordsPresetId] = useState('holding-display');

  // Inspector - list refresh (emulators/devices) & Appium polling reuse
  const [inspectorListsAuto, setInspectorListsAuto] = useState(true);
  const [inspectorListsSec, setInspectorListsSec] = useState(3);

  // Inspector - Snapshot auto refresh
  const [snapshotAuto, setSnapshotAuto] = useState(false);
  const [snapshotMs, setSnapshotMs] = useState(1200);
  const [snapshotAttempts, setSnapshotAttempts] = useState(6);
  const [inspectorClickableOnly, setInspectorClickableOnly] = useState(true);
  const [inspectorPreferAppium, setInspectorPreferAppium] = useState(false);
  const [inspectorOverlayMode, setInspectorOverlayMode] = useState<'boxes' | 'markers'>('boxes');

  // Testcases & Libs - Appium polling
  const [tcAppiumAuto, setTcAppiumAuto] = useState(true);
  const [libsAppiumAuto, setLibsAppiumAuto] = useState(true);
  const [libsEditorWrapColumn, setLibsEditorWrapColumn] = useState(80);

  // Libs AI defaults
  const [aiRulesOnlyDefault, setAiRulesOnlyDefault] = useState(false);
  const [aiMaxLinesDefault, setAiMaxLinesDefault] = useState(0);
  const [aiMaxColDefault, setAiMaxColDefault] = useState(0);

  // AI backend config (server-side)
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiApiKeyInput, setAiApiKeyInput] = useState('');
  const [aiClearKey, setAiClearKey] = useState(false);
  const [aiTimeoutMsValue, setAiTimeoutMsValue] = useState(10000);
  const [aiMaxTokens, setAiMaxTokens] = useState(512);

  useEffect(() => {
    // Local persisted settings (Inspector/Testcases/Libs)
    setInspectorAutoWake(readBool('gtt:inspector:autoWake', true));
    setInspectorAutoUnlock(readBool('gtt:inspector:autoUnlock', false));
    setUnlockPassword(readStr('gtt:inspector:unlockPassword', ''));
    setUnlockSwipe(readStr('gtt:inspector:unlockSwipe', ''));
    setUnlockKeywords(
      readStr('gtt:inspector:unlockKeywords', 'holding display'),
    );
    setKeywordsPresetId(
      readStr('gtt:inspector:unlockKeywordsPreset', 'holding-display'),
    );

    setInspectorListsAuto(readBool('gtt:inspector:lists:autoRefresh', true));
    setInspectorListsSec(
      clamp(readInt('gtt:inspector:lists:refreshSec', 3), 1, 60),
    );

    setSnapshotAuto(readBool('gtt:inspector:snapshot:autoRefresh', false));
    setSnapshotMs(
      clamp(readInt('gtt:inspector:snapshot:intervalMs', 1200), 100, 3000),
    );
    setSnapshotAttempts(
      clamp(readInt('gtt:inspector:snapshot:maxAttempts', 6), 1, 20),
    );
    setInspectorClickableOnly(readBool('gtt:inspector:clickableOnly', true));
    setInspectorPreferAppium(readBool('gtt:inspector:preferAppiumSource', false));
    try {
      const m = localStorage.getItem('gtt:inspector:overlayMode');
      setInspectorOverlayMode(m === 'markers' ? 'markers' : 'boxes');
    } catch {}

    setTcAppiumAuto(readBool('gtt:testcases:appiumAutoRefresh', true));
    setLibsAppiumAuto(readBool('gtt:testcases-libs:appiumAutoRefresh', true));
    setLibsEditorWrapColumn(
      clamp(readInt('gtt:testcases-libs:editor:wrapColumn', 80), 20, 240),
    );

    setAiRulesOnlyDefault(readBool('gtt:ai:libs:useRulesOnly', false));
    setAiMaxLinesDefault(clamp(readInt('gtt:ai:libs:maxLines', 0), 0, 200));
    setAiMaxColDefault(clamp(readInt('gtt:ai:libs:maxCol', 0), 0, 400));

    let cancelled = false;

    const loadAi = async () => {
      if (!isAuthenticated) return;
      try {
        const res = await fetch('/api/settings/ai', { cache: 'no-store' });
        if (!res.ok) {
          const err = await (async () => {
            try {
              const mod = await import('@/lib/error');
              return mod.normalizeResponseError(res);
            } catch {
              return { message: res.statusText };
            }
          })();
          if (!cancelled) {
            toast.error(err.message || 'Failed to load AI settings');
          }
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        setAiProvider(normalizeAiProvider(j?.provider));
        setAiModel(j?.model || 'gpt-4o-mini');
        setAiBaseUrl(j?.baseUrl || '');
        setAiHasKey(!!j?.hasApiKey);
        const timeout = Number(j?.timeoutMs ?? 0);
        if (Number.isFinite(timeout)) {
          const normalized =
            timeout <= 0 ? 0 : clamp(Math.floor(timeout), 0, 600000);
          setAiTimeoutMsValue(normalized);
        } else {
          setAiTimeoutMsValue(10000);
        }
        const maxTokens = Number(j?.maxTokens ?? 0);
        if (Number.isFinite(maxTokens) && maxTokens > 0) {
          setAiMaxTokens(clamp(Math.floor(maxTokens), 64, 512000));
        } else {
          setAiMaxTokens(512);
        }
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message || 'Failed to load AI settings');
        }
      }
    };

    loadAi();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const persistLocalSettings = () => {
    localStorage.setItem(
      'gtt:inspector:autoWake',
      inspectorAutoWake ? '1' : '0',
    );
    localStorage.setItem(
      'gtt:inspector:autoUnlock',
      inspectorAutoUnlock ? '1' : '0',
    );
    localStorage.setItem('gtt:inspector:unlockPassword', unlockPassword);
    localStorage.setItem('gtt:inspector:unlockSwipe', unlockSwipe);
    localStorage.setItem('gtt:inspector:unlockKeywords', unlockKeywords);
    localStorage.setItem(
      'gtt:inspector:unlockKeywordsPreset',
      keywordsPresetId,
    );

    localStorage.setItem(
      'gtt:inspector:lists:autoRefresh',
      inspectorListsAuto ? '1' : '0',
    );
    localStorage.setItem(
      'gtt:inspector:lists:refreshSec',
      String(clamp(inspectorListsSec | 0, 1, 60)),
    );

    localStorage.setItem(
      'gtt:testcases:appiumAutoRefresh',
      tcAppiumAuto ? '1' : '0',
    );
    localStorage.setItem(
      'gtt:testcases-libs:appiumAutoRefresh',
      libsAppiumAuto ? '1' : '0',
    );
    localStorage.setItem(
      'gtt:testcases-libs:editor:wrapColumn',
      String(clamp(libsEditorWrapColumn | 0, 20, 240)),
    );

    localStorage.setItem(
      'gtt:inspector:snapshot:autoRefresh',
      snapshotAuto ? '1' : '0',
    );
    localStorage.setItem(
      'gtt:inspector:snapshot:intervalMs',
      String(clamp(snapshotMs | 0, 100, 3000)),
    );
    localStorage.setItem(
      'gtt:inspector:snapshot:maxAttempts',
      String(clamp(snapshotAttempts | 0, 1, 20)),
    );
    localStorage.setItem(
      'gtt:inspector:clickableOnly',
      inspectorClickableOnly ? '1' : '0',
    );
    localStorage.setItem(
      'gtt:inspector:preferAppiumSource',
      inspectorPreferAppium ? '1' : '0',
    );
    localStorage.setItem('gtt:inspector:overlayMode', inspectorOverlayMode);

    localStorage.setItem(
      'gtt:ai:libs:useRulesOnly',
      aiRulesOnlyDefault ? '1' : '0',
    );
    localStorage.setItem(
      'gtt:ai:libs:maxLines',
      String(clamp(Math.floor(aiMaxLinesDefault), 0, 200)),
    );
    localStorage.setItem(
      'gtt:ai:libs:maxCol',
      String(clamp(Math.floor(aiMaxColDefault), 0, 400)),
    );
  };

  const syncAiSettings = async () => {
    if (!isAuthenticated) return;
    const payload: Record<string, unknown> = {
      provider: aiProvider,
      model: aiModel.trim(),
      baseUrl: aiBaseUrl.trim(),
    };
    if (aiApiKeyInput.trim()) payload.apiKey = aiApiKeyInput.trim();
    if (aiClearKey) payload.clearKey = true;

    if (Number.isFinite(aiTimeoutMsValue)) {
      const normalized =
        aiTimeoutMsValue <= 0
          ? 0
          : clamp(Math.floor(aiTimeoutMsValue), 0, 600000);
      payload.timeoutMs = normalized;
    }

    if (Number.isFinite(aiMaxTokens)) {
      payload.maxTokens = clamp(Math.floor(aiMaxTokens), 64, 512000);
    }

    const res = await fetch('/api/settings/ai', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await (async () => {
        try {
          const mod = await import('@/lib/error');
          return mod.normalizeResponseError(res);
        } catch {
          return { message: res.statusText };
        }
      })();
      throw new Error(err.message || 'Failed to save AI settings');
    }

    const j = await res.json();
    setAiHasKey(!!j?.hasApiKey);
    const returnedTimeout = Number(
      j?.timeoutMs ?? payload.timeoutMs ?? aiTimeoutMsValue,
    );
    if (Number.isFinite(returnedTimeout)) {
      const normalized =
        returnedTimeout <= 0
          ? 0
          : clamp(Math.floor(returnedTimeout), 0, 600000);
      setAiTimeoutMsValue(normalized);
    }
    const returnedMaxTokens = Number(
      j?.maxTokens ?? payload.maxTokens ?? aiMaxTokens,
    );
    if (Number.isFinite(returnedMaxTokens) && returnedMaxTokens > 0) {
      setAiMaxTokens(clamp(Math.floor(returnedMaxTokens), 64, 512000));
    }
    setAiApiKeyInput('');
    setAiClearKey(false);
  };

  const saveAll = async () => {
    try {
      persistLocalSettings();
      await syncAiSettings();
      toast.success('Settings saved');
      window.dispatchEvent(new Event('gtt-parameters-updated'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save settings');
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      save: () => {
        void saveAll();
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
    ],
  );

  const resetDefaults = () => {
    setInspectorAutoWake(true);
    setInspectorAutoUnlock(false);
    setUnlockPassword('');
    setUnlockSwipe('');
    setUnlockKeywords('holding display');
    setKeywordsPresetId('holding-display');

    setInspectorListsAuto(true);
    setInspectorListsSec(3);

    setSnapshotAuto(false);
    setSnapshotMs(1200);
    setSnapshotAttempts(6);
    setInspectorClickableOnly(true);
    setInspectorPreferAppium(false);
    setInspectorOverlayMode('boxes');

    setTcAppiumAuto(true);
    setLibsAppiumAuto(true);
    setLibsEditorWrapColumn(80);

    setAiRulesOnlyDefault(false);
    setAiMaxLinesDefault(0);
    setAiMaxColDefault(0);

    setAiTimeoutMsValue(10000);
    setAiMaxTokens(512);

    setAiProvider('openai');
    setAiModel('gpt-4o-mini');
    setAiBaseUrl('');
    setAiApiKeyInput('');
    setAiClearKey(false);
  };

  const baseUrlPlaceholder =
    aiProvider === 'grok'
      ? 'https://api.x.ai/v1'
      : 'https://api.openai.com/v1';

  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-3 lg:p-4">
      <div className="grid gap-4 xl:grid-cols-[2.1fr,1fr]">
        <div className="flex flex-col gap-4">
          <Section
            title="Inspector"
            description="Control snapshot automation and Android device polling."
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Snapshot unlock &amp; wake
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ins-auto-wake"
                      checked={inspectorAutoWake}
                      onCheckedChange={(v) => setInspectorAutoWake(!!v)}
                    />
                    <Label
                      htmlFor="ins-auto-wake"
                      className="cursor-pointer select-none text-xs"
                    >
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
                      className="cursor-pointer select-none text-xs"
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
                      className="text-xs text-muted-foreground"
                    >
                      Preset
                    </Label>
                    <Select
                      value={keywordsPresetId}
                      onValueChange={(v) => {
                        setKeywordsPresetId(v);
                        const p = keywordPresets.find((x) => x.id === v);
                        if (p) setUnlockKeywords(p.value);
                      }}
                    >
                      <SelectTrigger
                        id="ins-keywords-preset"
                        className="h-8 w-[220px]"
                      >
                        <SelectValue placeholder="Keyword presets" />
                      </SelectTrigger>
                      <SelectContent>
                        {keywordPresets.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">
                          Custom (use input)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Snapshot auto refresh
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ins-snapshot-auto"
                      checked={snapshotAuto}
                      onCheckedChange={(v) => setSnapshotAuto(!!v)}
                    />
                    <Label
                      htmlFor="ins-snapshot-auto"
                      className="cursor-pointer select-none text-xs"
                    >
                      Enable
                    </Label>
                  </div>
                  <Label
                    htmlFor="ins-snapshot-ms"
                    className="text-xs text-muted-foreground"
                  >
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
                      setSnapshotMs(
                        clamp(parseInt(e.target.value || '400', 10), 100, 3000),
                      )
                    }
                  />
                  <span className="text-xs text-muted-foreground">ms</span>
                  <Label
                    htmlFor="ins-snapshot-attempts"
                    className="text-xs text-muted-foreground"
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
                      setSnapshotAttempts(
                        clamp(parseInt(e.target.value || '6', 10), 1, 20),
                      )
                    }
                  />
                </div>
              </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Device list refresh
              </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ins-lists-auto"
                      checked={inspectorListsAuto}
                      onCheckedChange={(v) => setInspectorListsAuto(!!v)}
                    />
                    <Label
                      htmlFor="ins-lists-auto"
                      className="cursor-pointer select-none text-xs"
                    >
                      Lists auto refresh
                    </Label>
                  </div>
                  <Label
                    htmlFor="ins-lists-sec"
                    className="text-xs text-muted-foreground"
                  >
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
                      setInspectorListsSec(
                        clamp(parseInt(e.target.value || '3', 10), 1, 60),
                      )
                    }
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Overlay &amp; filters</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ins-overlay-clickable-only"
                    checked={inspectorClickableOnly}
                    onCheckedChange={(v) => setInspectorClickableOnly(!!v)}
                  />
                  <Label
                    htmlFor="ins-overlay-clickable-only"
                    className="cursor-pointer select-none text-xs"
                  >
                    Clickable only
                  </Label>
                </div>
                <div className="text-xs text-muted-foreground">
                  Applies to Inspector and Libs overlay.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="ins-overlay-mode" className="text-xs text-muted-foreground">
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
                  <Label htmlFor="ins-prefer-appium" className="cursor-pointer select-none text-xs">
                    Use Appium pageSource (faster; may hang under load)
                  </Label>
                </div>
                <div className="text-xs text-muted-foreground">Fallback to ADB dump on failure.</div>
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
                  <Label
                    htmlFor="tc-appium-auto"
                    className="cursor-pointer select-none text-xs"
                  >
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
                    className="cursor-pointer select-none text-xs"
                  >
                    Libs Appium auto refresh
                  </Label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Label
                  htmlFor="libs-editor-wrap"
                  className="text-xs text-muted-foreground"
                >
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
                    setLibsEditorWrapColumn(
                      clamp(parseInt(e.target.value || '80', 10), 20, 240),
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">chars</span>
              </div>
            </div>
          </Section>

          <Section
            title="AI Defaults"
            description="Initial values for the Libs AI helper."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ai-rules-only"
                    checked={aiRulesOnlyDefault}
                    onCheckedChange={(v) => setAiRulesOnlyDefault(!!v)}
                  />
                  <Label
                    htmlFor="ai-rules-only"
                    className="cursor-pointer select-none text-xs"
                  >
                    Use rule-only prompt by default
                  </Label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="ai-max-lines"
                    className="text-xs text-muted-foreground"
                  >
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
                      const n = parseInt(e.target.value || '0', 10);
                      if (!Number.isFinite(n)) {
                        setAiMaxLinesDefault(0);
                      } else {
                        setAiMaxLinesDefault(clamp(n, 0, 200));
                      }
                    }}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground">
                    0 = unlimited
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="ai-max-col"
                    className="text-xs text-muted-foreground"
                  >
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
                      const n = parseInt(e.target.value || '0', 10);
                      if (!Number.isFinite(n)) {
                        setAiMaxColDefault(0);
                      } else {
                        setAiMaxColDefault(clamp(n, 0, 400));
                      }
                    }}
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground">
                    0 = unlimited
                  </span>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="AI Backend"
            description="Server-side LLM provider configuration."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="ai-provider"
                    className="text-xs text-muted-foreground"
                  >
                    Provider
                  </Label>
                  <Select
                    value={aiProvider}
                    onValueChange={(value) =>
                      setAiProvider(normalizeAiProvider(value))
                    }
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
                  <Label
                    htmlFor="ai-model"
                    className="text-xs text-muted-foreground"
                  >
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
                <Label
                  htmlFor="ai-base-url"
                  className="text-xs text-muted-foreground"
                >
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
                  <Label
                    htmlFor="ai-timeout"
                    className="text-xs text-muted-foreground"
                  >
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
                      const raw = parseInt(e.target.value || '0', 10);
                      if (!Number.isFinite(raw)) {
                        setAiTimeoutMsValue(0);
                      } else {
                        setAiTimeoutMsValue(clamp(Math.floor(raw), 0, 600000));
                      }
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    0 = no timeout
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="ai-max-tokens"
                    className="text-xs text-muted-foreground"
                  >
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
                      const val = Number(e.target.value);
                      if (!Number.isFinite(val)) {
                        setAiMaxTokens(512);
                      } else {
                        setAiMaxTokens(clamp(Math.floor(val), 64, 512000));
                      }
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Label
                  htmlFor="ai-key"
                  className="text-xs text-muted-foreground"
                >
                  API key
                </Label>
                <Input
                  id="ai-key"
                  type="password"
                  className="h-8 w-[360px]"
                  value={aiApiKeyInput}
                  onChange={(e) => setAiApiKeyInput(e.target.value)}
                  placeholder={
                    aiHasKey ? '******** (set to replace)' : 'sk-...'
                  }
                />
                <div className="flex items-center gap-2">
                  <Switch
                    id="ai-clear-key"
                    checked={aiClearKey}
                    onCheckedChange={(v) => setAiClearKey(!!v)}
                  />
                  <Label
                    htmlFor="ai-clear-key"
                    className="cursor-pointer select-none text-xs"
                  >
                    Clear saved key
                  </Label>
                </div>
              </div>
            </div>
          </Section>
        </div>

        <Section
          title="Help"
          className="h-fit"
          description="快速回顾常用字段的含义与获取方式。"
        >
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>如何获取 Password / Swipe / Keywords：</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="font-medium text-foreground">Password</span>
                ：锁屏 PIN/密码（图案或无密码可留空）。
              </li>
              <li>
                <span className="font-medium text-foreground">Swipe</span>
                ：解锁滑动手势，格式 <code>x1 y1 x2 y2</code>（像素）。可用
                Inspector 获取坐标或参考截图估算。
              </li>
              <li>
                <span className="font-medium text-foreground">Keywords</span>
                ：用于识别“屏幕已点亮/设备已唤醒”的文本，来自{' '}
                <code>adb shell dumpsys power</code> 输出。例如：
                <code className="ml-1">holding display</code>、
                <code className="ml-1">Display Power: state=ON</code>、
                <code className="ml-1">mWakefulness=Awake</code>、
                <code className="ml-1">mScreenOn=true</code>。
                若系统输出不同，请在命令行执行{' '}
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
  );
});
