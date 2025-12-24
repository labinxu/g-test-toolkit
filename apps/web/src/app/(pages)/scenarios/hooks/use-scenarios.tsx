'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../testcases/socket-content';
import { Button } from '@/components/ui/button';
import { type OptionsSelectItem } from '@/components/select/options-select';
import type {
  CaseStatus,
  UserScenarioSummary,
  UserScenarioStep,
  ActionCatalog,
  PageActionDef,
  PageDef,
  StepBindingV1,
  StepCheckRule,
  StepCheckRuleType,
  StepParamHint,
  EnvTemplateSummary,
  UserScenarioSuiteSummary,
} from '../types';
import {
  normalizeResponseError,
  isUnauthorizedError,
  ensureResponseOk,
} from '@/lib/error';
import { toast } from 'sonner';
const STATUS_LABEL: Record<CaseStatus, string> = {
  draft: '草稿',
  in_progress: '完善中',
  ready: '已准备',
  code_generated: '已生成代码',
};

const PRIORITY_LABEL: Record<'P0' | 'P1' | 'P2', string> = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
};

const SUBMENU_LABEL: Record<string, string> = {
  host: '主播侧',
  viewer: '观众侧',
  interaction: '互动',
};

type RunTaskStatus = 'pending' | 'running' | 'success' | 'failed';
type RunTask = {
  id: number;
  title: string;
  status: RunTaskStatus;
  filePath?: string | null;
  error?: string | null;
};

const getEnvTemplateStorageKey = (platform: string, driver: string): string =>
  `gtt:envTemplate:${platform || 'default'}:${driver || 'browser'}`;
const getRunEnvStorageKey = (platform: string, driver: string): string =>
  `gtt:scenarios:runEnv:${platform || 'default'}:${driver || 'browser'}`;

const inferDriverFromPlatform = (
  platform: string | null | undefined,
): 'browser' | 'android' | 'ios' | 'other' => {
  if (!platform) return 'browser';
  if (platform.includes('android')) return 'android';
  if (platform.includes('-api-')) return 'other';
  return 'browser';
};

export function useScenariosModel() {
  const router = useRouter();
  const {
    logs: socketLogs,
    clearLogs,
    clientId,
    connected: socketConnected,
    running: socketRunning,
    setRunning: setSocketRunning,
  } = useSocket();
  const [cases, setCases] = useState<UserScenarioSummary[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [stepsByCase, setStepsByCase] = useState<
    Record<number, UserScenarioStep[]>
  >({});
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [ingestingDoc, setIngestingDoc] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [metaOpen, setMetaOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(50);
  const [tableSelectedKeys, setTableSelectedKeys] = useState<Set<string>>(
    new Set(),
  );
  const [tableTotalRows, setTableTotalRows] = useState(0);
  const [tableFilteredRows, setTableFilteredRows] = useState(0);
  const [actionCatalog, setActionCatalog] = useState<ActionCatalog | null>(
    null,
  );
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [runQueue, setRunQueue] = useState<RunTask[]>([]);
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [runningCaseId, setRunningCaseId] = useState<number | null>(null);
  const [runEnvTemplates, setRunEnvTemplates] = useState<EnvTemplateSummary[]>(
    [],
  );
  const [runEnvSelectedId, setRunEnvSelectedId] = useState<
    string | 'none'
  >('none');
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [stepDialogPageKey, setStepDialogPageKey] = useState<
    string | undefined
  >(undefined);
  const [stepDialogActionKey, setStepDialogActionKey] = useState<
    string | undefined
  >(undefined);
  const [stepDialogArgs, setStepDialogArgs] = useState<Record<string, string>>(
    {},
  );
  const [stepDialogExpected, setStepDialogExpected] = useState('');
  const [stepDialogActionText, setStepDialogActionText] = useState('');
  const [stepDialogCheckType, setStepDialogCheckType] = useState<
    StepCheckRuleType | ''
  >('');
  const [stepDialogCheckLocator, setStepDialogCheckLocator] = useState('');
  const [stepDialogCheckExpectedUrl, setStepDialogCheckExpectedUrl] =
    useState('');
  const [stepDialogCheckTimeoutMs, setStepDialogCheckTimeoutMs] = useState('');
  const [editingStepIdForDialog, setEditingStepIdForDialog] = useState<
    string | null
  >(null);
  const [stepDialogOrder, setStepDialogOrder] = useState<number>(1);
  const [stepDialogApiMethod, setStepDialogApiMethod] = useState<string>('GET');
  const [stepDialogApiPath, setStepDialogApiPath] = useState<string>('');
  const [stepDialogApiBody, setStepDialogApiBody] = useState<string>('');
  const [stepDialogTarget, setStepDialogTarget] = useState<'case' | 'suite'>('case');
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [envDialogLoading, setEnvDialogLoading] = useState(false);
  const [envDialogTemplates, setEnvDialogTemplates] = useState<
    EnvTemplateSummary[]
  >([]);
  const [envDialogCaseId, setEnvDialogCaseId] = useState<number | null>(null);
  const [envDialogSelectedId, setEnvDialogSelectedId] = useState<
    number | 'none' | null
  >('none');
  const [envDialogPlatform, setEnvDialogPlatform] =
    useState<string>('gettr-web');
  const [envDialogDriver, setEnvDialogDriver] = useState<
    'browser' | 'android' | 'ios' | 'other'
  >('browser');
  const [docAiPromptOpen, setDocAiPromptOpen] = useState(false);
  const [docAiPromptText, setDocAiPromptText] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('gtt:scenarios:docAiHint') || '';
    } catch {
      return '';
    }
  });
  const [platform, setPlatform] = useState<string>(() => {
    if (typeof window === 'undefined') return 'gettr-web';
    try {
      return localStorage.getItem('gtt:scenarios:platform') || 'gettr-web';
    } catch {
      return 'gettr-web';
    }
  });
  const [platforms, setPlatforms] = useState<OptionsSelectItem<string>[]>([]);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCaseSubmitting, setNewCaseSubmitting] = useState(false);
  const [newCaseCode, setNewCaseCode] = useState('');
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseFeature, setNewCaseFeature] = useState('');
  const [newCaseSubmenu, setNewCaseSubmenu] = useState<string | undefined>();
  const [newCasePriority, setNewCasePriority] = useState<'P0' | 'P1' | 'P2'>(
    'P1',
  );
  const [newCaseStatus, setNewCaseStatus] = useState<CaseStatus>('draft');
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [newCaseAcceptance, setNewCaseAcceptance] = useState('');
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingSubmenu, setEditingSubmenu] = useState<string | null>(null);
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [moduleItems, setModuleItems] = useState<OptionsSelectItem<string>[]>(
    [],
  );
  const [submenuItems, setSubmenuItems] = useState<OptionsSelectItem<string>[]>(
    [],
  );
  const [priorityItems, setPriorityItems] = useState<
    OptionsSelectItem<'P0' | 'P1' | 'P2'>[]
  >([]);
  const [suites, setSuites] = useState<UserScenarioSuiteSummary[]>([]);
  const [suiteLoading, setSuiteLoading] = useState(false);
  const [suiteSaving, setSuiteSaving] = useState(false);
  const [suiteDialogOpen, setSuiteDialogOpen] = useState(false);
  const [suitePreSteps, setSuitePreSteps] = useState<string[]>([]);
  const [suitePreStepDraft, setSuitePreStepDraft] = useState('');
  const [suiteDescDraft, setSuiteDescDraft] = useState('');
  const [suiteNameDraft, setSuiteNameDraft] = useState('');
  const [selectedSuiteId, setSelectedSuiteId] = useState<number | null>(null);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDesc, setNewSuiteDesc] = useState('');
  const [suiteGenerating, setSuiteGenerating] = useState(false);
  const [suiteDeleting, setSuiteDeleting] = useState(false);
  type SuiteActorDraft = {
    name: string;
    scope: 'suite' | 'test';
    authMode: 'ui' | 'cookies';
    cookiesPath: string;
  };
  const [suiteActorsDraft, setSuiteActorsDraft] = useState<SuiteActorDraft[]>(
    [],
  );
  const [suiteDefaultActorDraft, setSuiteDefaultActorDraft] = useState<string>(
    '',
  );

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId],
  );

useEffect(() => {
  // 切换选中用例时，重置标题编辑缓存
  setEditingTitle(null);
  setEditingSubmenu(null);
  setEditingPriority(null);
  setEditingModule(null);
}, [selectedCaseId]);

  useEffect(() => {
    if (!selectedCase) {
      setSelectedSuiteId(null);
      setSuitePreSteps([]);
      setSuitePreStepDraft('');
      setSuiteDescDraft('');
      setSuiteNameDraft('');
      return;
    }
    const suiteIdFromCase = selectedCase.suiteId ?? null;
    setSelectedSuiteId(suiteIdFromCase);
  }, [selectedCase]);

  useEffect(() => {
    if (!selectedSuiteId) {
      setSuitePreSteps([]);
      setSuitePreStepDraft('');
      setSuiteDescDraft('');
      setSuiteNameDraft('');
      setSuiteActorsDraft([]);
      setSuiteDefaultActorDraft('');
      return;
    }
    const suite = suites.find((s) => s.id === selectedSuiteId);
    setSuitePreSteps(suite?.sharedPreSteps || []);
    setSuitePreStepDraft('');
    setSuiteDescDraft(suite?.description || '');
    setSuiteNameDraft(suite?.name || '');
    const actorsObj =
      suite?.actors && typeof suite.actors === 'object' ? suite.actors : null;
    const nextActors: SuiteActorDraft[] = actorsObj
      ? Object.entries(actorsObj)
          .map(([name, opt]) => {
            const rec: any = opt && typeof opt === 'object' ? opt : {};
            const auth: any =
              rec.auth && typeof rec.auth === 'object' ? rec.auth : {};
            const mode: SuiteActorDraft['authMode'] =
              auth.mode === 'cookies' ? 'cookies' : 'ui';
            const scope: SuiteActorDraft['scope'] =
              rec.scope === 'test' ? 'test' : 'suite';
            return {
              name: String(name || ''),
              scope,
              authMode: mode,
              cookiesPath: mode === 'cookies' ? String(auth.cookiesPath || '') : '',
            };
          })
          .filter((r) => !!r.name.trim())
      : [];
    setSuiteActorsDraft(nextActors);
    setSuiteDefaultActorDraft(
      suite?.defaultActor ? String(suite.defaultActor) : '',
    );
  }, [selectedSuiteId, suites]);

  // Restore last selected case when coming back from Testcases (via gtt:scenarios:lastCaseId)
  useEffect(() => {
    if (!cases.length) return;
    if (selectedCaseId != null) return;
    try {
      const raw = localStorage.getItem('gtt:scenarios:lastCaseId');
      if (!raw) return;
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      const exists = cases.some((c) => c.id === n);
      if (exists) {
        setSelectedCaseId(n);
      }
    } catch {}
  }, [cases, selectedCaseId]);

  useEffect(() => {
    if (selectedCaseId == null) return;
    void loadCaseSteps(selectedCaseId);
  }, [selectedCaseId]);

  const filteredCases = useMemo(() => cases, [cases]);

  const totalPages = useMemo(
    () =>
      Math.max(1, Math.ceil(filteredCases.length / Math.max(1, tablePageSize))),
    [filteredCases.length, tablePageSize],
  );
  const safePage = Math.max(1, Math.min(totalPages, tablePage));

  const currentSteps: UserScenarioStep[] = useMemo(() => {
    if (!selectedCase) return [];
    return (stepsByCase[selectedCase.id] || [])
      .slice()
      .sort((a, b) => a.order - b.order);
  }, [selectedCase, stepsByCase]);

  const apiPrefix = '/api/user-scenarios';
  const moduleLabelMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of moduleItems) {
      m[it.value] = it.label;
    }
    return m;
  }, [moduleItems]);
  const dialogPlatform = (
    (stepDialogTarget === 'case' ? selectedCase?.platform : platform) ||
    platform ||
    ''
  )
    .toString()
    .toLowerCase();
  const isDialogApiPlatform = dialogPlatform.includes('-api-');
  const statusItems: OptionsSelectItem<CaseStatus>[] = [
    { label: '草稿', value: 'draft' },
    { label: '完善中', value: 'in_progress' },
    { label: '已准备', value: 'ready' },
    { label: '已生成代码', value: 'code_generated' },
  ];

  const handleStepDialogOpenChange = (open: boolean) => {
    setStepDialogOpen(open);
    if (!open) {
      setStepDialogTarget('case');
      setEditingStepIdForDialog(null);
    }
  };

  const handleStepDialogSubmit = () => {
    const isSuiteTarget = stepDialogTarget === 'suite';
    const effectivePlatform = (
      (isSuiteTarget ? platform : selectedCase?.platform) ||
      platform ||
      ''
    )
      .toString()
      .toLowerCase();
    const isApiPlatform = effectivePlatform.includes('-api-');

    if (!selectedCase && !isSuiteTarget) {
      toast.error('请先在左侧选择一个用例');
      return;
    }

    if (isApiPlatform) {
      const method =
        (stepDialogApiMethod || 'GET').toString().trim().toUpperCase() || 'GET';
      const pathVal = (stepDialogApiPath || '').toString().trim();
      const bodyVal = (stepDialogApiBody || '').toString().trim();
      const parts: string[] = [];
      if (method) parts.push(`method=${method}`);
      if (pathVal) parts.push(`path=${pathVal}`);
      if (bodyVal) parts.push(`body=${bodyVal}`);
      const dataText = parts.join(', ');
      const actionText = (stepDialogActionText || '').trim() || 'API 调用';
      const expectedText = (stepDialogExpected || '').trim() || '（待补充）';

      if (isSuiteTarget) {
        const nextOrder =
          (stepDialogOrder && Number.isFinite(stepDialogOrder)
            ? Number(stepDialogOrder)
            : suitePreSteps.length + 1) || 1;
        const payload = {
          order: nextOrder,
          action: actionText,
          data: dataText,
          expected: expectedText,
        };
        if (editingStepIdForDialog && editingStepIdForDialog.startsWith('suite-')) {
          const idx = Number(editingStepIdForDialog.replace('suite-', ''));
          setSuitePreSteps((prev) => {
            const next = [...prev];
            if (idx >= 0 && idx < next.length) {
              next[idx] = JSON.stringify(payload);
              return next;
            }
            return [...prev, JSON.stringify(payload)];
          });
        } else {
          setSuitePreSteps([...suitePreSteps, JSON.stringify(payload)]);
        }
        setEditingStepIdForDialog(null);
        setStepDialogTarget('case');
        setStepDialogOpen(false);
        return;
      }

      const caseId = selectedCase!.id;
      setStepsByCase((prev) => {
        const currentList = prev[caseId] || [];

        if (editingStepIdForDialog) {
          const targetId = editingStepIdForDialog;
          const updated = currentList.map((s) =>
            s.id === targetId
              ? {
                  ...s,
                  action: actionText,
                  data: dataText,
                  expected: expectedText,
                }
              : s,
          );
          return { ...prev, [caseId]: updated };
        }

       const baseOrder =
         stepDialogOrder && Number.isFinite(stepDialogOrder)
           ? stepDialogOrder
           : currentList.length > 0
             ? Math.max(...currentList.map((s) => s.order)) + 1
             : 1;

       const newStep: UserScenarioStep = {
         id: `${caseId}-${Date.now()}`,
         order: baseOrder,
         action: actionText,
         data: dataText,
         expected: expectedText,
       };
        const nextList = [...currentList, newStep].map((s, i) => ({
          ...s,
          order: i + 1,
        }));
        return { ...prev, [caseId]: nextList };
      });
      setEditingStepIdForDialog(null);
      setStepDialogTarget('case');
      setStepDialogOpen(false);
      return;
    }

    const catalog = actionCatalog;
    if (!catalog) {
      toast.error('页面动作目录尚未加载');
      return;
    }
    const page =
      catalog.pages.find((p) => p.key === stepDialogPageKey) ||
      catalog.pages[0] ||
      null;
    if (!page) {
      toast.error('请先选择页面');
      return;
    }
    const action =
      page.actions.find((a) => a.key === stepDialogActionKey) || null;
    if (!action) {
      toast.error('请先选择动作');
      return;
    }
    const params = action.params || [];
    for (const param of params) {
      if (param.required && !stepDialogArgs[param.name]) {
        toast.error(`请输入参数：${param.name}`);
        return;
      }
    }
    let checkRule: StepCheckRule | undefined;
    if (stepDialogCheckType) {
      if (
        stepDialogCheckType === 'element-visible' ||
        stepDialogCheckType === 'element-hidden'
      ) {
        const rawLocator =
          stepDialogCheckLocator.trim() ||
          ((action as any).locator ? String((action as any).locator).trim() : '');
        if (!rawLocator) {
          toast.error('请选择“元素出现/消失”时需补充元素定位字符串');
          return;
        }
        const timeoutNum = Number(stepDialogCheckTimeoutMs || '');
        checkRule = {
          type: stepDialogCheckType,
          locator: rawLocator,
          timeoutMs:
            Number.isFinite(timeoutNum) && timeoutNum > 0
              ? Math.floor(timeoutNum)
              : undefined,
        };
      } else if (
        stepDialogCheckType === 'url-contains' ||
        stepDialogCheckType === 'url-equals'
      ) {
        const rawUrl = stepDialogCheckExpectedUrl.trim();
        if (!rawUrl) {
          toast.error('请选择“URL 检查”时需补充期望 URL');
          return;
        }
        const timeoutNum = Number(stepDialogCheckTimeoutMs || '');
        checkRule = {
          type: stepDialogCheckType,
          expectedUrl: rawUrl,
          timeoutMs:
            Number.isFinite(timeoutNum) && timeoutNum > 0
              ? Math.floor(timeoutNum)
              : undefined,
        };
      }
    }
    const binding: StepBindingV1 = {
      ver: 1,
      platform: effectivePlatform,
      pageKey: page.key,
      actionKey: action.key,
      args: action.params?.map((p) => ({
        name: p.name,
        value: stepDialogArgs[p.name] || '',
      })),
      checkRule,
    };
    const actionLabel = action.label || action.key || '步骤';
    const pageLabel = page.label || page.key || '页面';
    const humanAction =
      (stepDialogActionText || '').trim() || `${pageLabel} · ${actionLabel}`;
    const expectedText = (stepDialogExpected || '').trim() || '（待补充）';

    if (isSuiteTarget) {
      const nextOrder =
        (stepDialogOrder && Number.isFinite(stepDialogOrder)
          ? Number(stepDialogOrder)
          : suitePreSteps.length + 1) || 1;
      const payload = {
        order: nextOrder,
        action: humanAction,
        expected: expectedText,
        binding,
      };
      if (editingStepIdForDialog && editingStepIdForDialog.startsWith('suite-')) {
        const idx = Number(editingStepIdForDialog.replace('suite-', ''));
        setSuitePreSteps((prev) => {
          const next = [...prev];
          if (idx >= 0 && idx < next.length) {
            next[idx] = JSON.stringify(payload);
            return next;
          }
          return [...prev, JSON.stringify(payload)];
        });
      } else {
        setSuitePreSteps([...suitePreSteps, JSON.stringify(payload)]);
      }
      setEditingStepIdForDialog(null);
      setStepDialogTarget('case');
      setStepDialogOpen(false);
      return;
    }

    setStepsByCase((prev) => {
      if (!selectedCase) return prev;
      const caseId = selectedCase.id;
      const list = prev[caseId] || [];

      if (editingStepIdForDialog) {
        const targetId = editingStepIdForDialog;
        const updated = list.map((s) =>
          s.id === targetId
            ? {
                ...s,
                action: humanAction,
                expected: expectedText,
                binding: JSON.stringify(binding),
              }
            : s,
        );
        return { ...prev, [caseId]: updated };
      }

     const baseOrder =
       stepDialogOrder && Number.isFinite(stepDialogOrder)
         ? stepDialogOrder
         : list.length > 0
           ? Math.max(...list.map((s) => s.order)) + 1
           : 1;

     const newStep: UserScenarioStep = {
       id: `${caseId}-${Date.now()}`,
       order: baseOrder,
       action: humanAction,
       expected: expectedText,
       binding: JSON.stringify(binding),
     };
      const nextList = [...list, newStep].map((s, i) => ({
        ...s,
        order: i + 1,
      }));
      return { ...prev, [caseId]: nextList };
    });
    setEditingStepIdForDialog(null);
    setStepDialogTarget('case');
    setStepDialogOpen(false);
  };

  const handleEnvDialogConfirm = async () => {
    if (!envDialogCaseId) return;
    const tplId =
      envDialogSelectedId && envDialogSelectedId !== 'none'
        ? Number(envDialogSelectedId)
        : null;
    setEnvDialogLoading(true);
    try {
      if (tplId != null) {
        try {
          const key = getEnvTemplateStorageKey(envDialogPlatform, envDialogDriver);
          localStorage.setItem(key, String(tplId));
        } catch {
          // ignore
        }
      }
      await generateCodeForCase(envDialogCaseId, tplId);
      setEnvDialogOpen(false);
    } finally {
      setEnvDialogLoading(false);
    }
  };

  const handleDocAiConfirm = () => {
    try {
      localStorage.setItem('gtt:scenarios:docAiHint', docAiPromptText || '');
    } catch {
      // ignore
    }
    setDocAiPromptOpen(false);
    const input = document.getElementById('ls-upload-doc') as HTMLInputElement | null;
    input?.click();
  };

  const handleAddStep = () => {
    setStepDialogTarget('case');
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例');
      return;
    }
    const plat = (selectedCase.platform || platform || '')
      .toString()
      .toLowerCase();
    const isApiPlatform = plat.includes('-api-');

    if (isApiPlatform) {
      const caseId = selectedCase.id;
      const list = stepsByCase[caseId] || [];
      const nextOrder = list.length
        ? Math.max(...list.map((s) => s.order)) + 1
        : 1;
      setEditingStepIdForDialog(null);
      setStepDialogOrder(nextOrder);
      setStepDialogApiMethod('GET');
      setStepDialogApiPath('');
      setStepDialogApiBody('');
      setStepDialogActionText('');
      setStepDialogExpected('');
      setStepDialogPageKey(undefined);
      setStepDialogActionKey(undefined);
      setStepDialogArgs({});
      setStepDialogCheckType('');
      setStepDialogCheckLocator('');
      setStepDialogCheckExpectedUrl('');
      setStepDialogCheckTimeoutMs('');
      setStepDialogOpen(true);
      return;
    }

    // 如果尚未加载动作目录，回退到手工模式
    if (!actionCatalog || !actionCatalog.pages?.length) {
      setStepsByCase((prev) => {
        const list = prev[selectedCase.id] || [];
        const nextOrder = list.length
          ? Math.max(...list.map((s) => s.order)) + 1
          : 1;
        const next: UserScenarioStep = {
          id: `${selectedCase.id}-${Date.now()}`,
          order: nextOrder,
          action: '',
          expected: '',
        };
        return { ...prev, [selectedCase.id]: [...list, next] };
      });
      return;
    }
    // 使用“页面 + 动作”对话框（新增模式）
    const firstPage = actionCatalog.pages[0];
    setEditingStepIdForDialog(null);
    setStepDialogPageKey(firstPage?.key);
    setStepDialogActionKey(undefined);
    setStepDialogArgs({});
    setStepDialogExpected('');
    setStepDialogActionText('');
    setStepDialogCheckType('');
    setStepDialogCheckLocator('');
    setStepDialogCheckExpectedUrl('');
    setStepDialogCheckTimeoutMs('');
    setStepDialogOpen(true);
  };

  const handleAddSuitePreStep = () => {
    if (!selectedSuiteId) {
      toast.error('请先选择一个套件');
      return;
    }
    setStepDialogTarget('suite');
    const plat = (selectedCase?.platform || platform || '')
      .toString()
      .toLowerCase();
    const isApiPlatform = plat.includes('-api-');

    if (isApiPlatform) {
      setEditingStepIdForDialog(null);
      setStepDialogOrder(suitePreSteps.length + 1);
      setStepDialogApiMethod('GET');
      setStepDialogApiPath('');
      setStepDialogApiBody('');
      setStepDialogActionText('');
      setStepDialogExpected('');
      setStepDialogPageKey(undefined);
      setStepDialogActionKey(undefined);
      setStepDialogArgs({});
      setStepDialogCheckType('');
      setStepDialogCheckLocator('');
      setStepDialogCheckExpectedUrl('');
      setStepDialogCheckTimeoutMs('');
      setStepDialogOpen(true);
      return;
    }

    if (!actionCatalog || !actionCatalog.pages?.length) {
      setSuitePreSteps([...suitePreSteps, '']);
      return;
    }
    const firstPage = actionCatalog.pages[0];
    setEditingStepIdForDialog(null);
    setStepDialogPageKey(firstPage?.key);
    setStepDialogActionKey(undefined);
    setStepDialogArgs({});
    setStepDialogExpected('');
    setStepDialogActionText('');
    setStepDialogCheckType('');
    setStepDialogCheckLocator('');
    setStepDialogCheckExpectedUrl('');
    setStepDialogCheckTimeoutMs('');
    setStepDialogOpen(true);
  };

  const handleEditSuitePreStep = (stepId: string) => {
    if (!selectedSuiteId) {
      toast.error('请先选择一个套件');
      return;
    }
    setStepDialogTarget('suite');
    const idx = suitePreSteps.findIndex((_, i) => `suite-${i}` === stepId);
    if (idx < 0) return;
    const raw = suitePreSteps[idx];
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    const plat = (platform || '').toString().toLowerCase();
    const isApiPlatform = plat.includes('-api-');
    const order = Number.isFinite(parsed?.order) ? Number(parsed.order) : idx + 1;
    setEditingStepIdForDialog(`suite-${idx}`);
    setStepDialogOrder(order);

    if (isApiPlatform) {
    const actionText = (parsed?.action || raw || '').toString();
      const expectedText = (parsed?.expected || '').toString();
      let method = 'GET';
      let pathVal = '';
      let bodyVal = '';
      const rawData = (parsed?.data || '').toString();
      if (rawData.trim()) {
        for (const part of rawData.split(',')) {
          const seg = part.trim();
          if (!seg) continue;
          const eqIdx = seg.indexOf('=');
          if (eqIdx <= 0) continue;
          const name = seg.slice(0, eqIdx).trim().toLowerCase();
          const value = seg.slice(eqIdx + 1).trim();
          if (name === 'method') method = value || method;
          else if (name === 'path') pathVal = value;
          else if (name === 'body' || name === 'payload') bodyVal = value;
        }
      }
      setStepDialogPageKey(undefined);
      setStepDialogActionKey(undefined);
      setStepDialogArgs({});
      setStepDialogExpected(expectedText);
      setStepDialogActionText(actionText);
      setStepDialogCheckType('');
      setStepDialogCheckLocator('');
      setStepDialogCheckExpectedUrl('');
      setStepDialogCheckTimeoutMs('');
      setStepDialogApiMethod(method || 'GET');
      setStepDialogApiPath(pathVal);
      setStepDialogApiBody(bodyVal);
      setStepDialogOpen(true);
      return;
    }

    if (!actionCatalog || !actionCatalog.pages?.length) {
      toast.error('页面动作目录尚未加载');
      return;
    }

    let binding: StepBindingV1 | null = null;
    try {
      if (parsed?.binding) {
        binding =
          typeof parsed.binding === 'string'
            ? (JSON.parse(parsed.binding) as StepBindingV1)
            : (parsed.binding as StepBindingV1);
      }
    } catch {
      binding = null;
    }
    const pages = actionCatalog.pages || [];
    let pageKey: string | undefined;
    let actionKey: string | undefined;
    let argsFromBinding: Record<string, string> = {};

    if (binding && binding.pageKey && binding.actionKey) {
      pageKey = binding.pageKey;
      actionKey = binding.actionKey;
      if (Array.isArray(binding.args)) {
        for (const arg of binding.args) {
          if (!arg || !arg.name) continue;
          argsFromBinding[arg.name] = arg.value ?? '';
        }
      }
    }

    const resolvedPage =
      (pageKey && pages.find((p) => p.key === pageKey)) || pages[0] || null;
    const resolvedAction =
      resolvedPage &&
      ((actionKey && resolvedPage.actions.find((a) => a.key === actionKey)) ||
        resolvedPage.actions[0] ||
        null);

    if (!resolvedPage || !resolvedAction) {
      toast.error('当前步骤未绑定到可解析的页面/动作，请重新选择');
      setStepDialogPageKey(pages[0]?.key);
      setStepDialogActionKey(undefined);
      setStepDialogArgs({});
      setStepDialogExpected((parsed?.expected || '').toString());
      setStepDialogActionText((parsed?.action || '').toString());
      setStepDialogOrder(order);
      setStepDialogOpen(true);
      return;
    }

    const paramArgs: Record<string, string> = {};
    const params = resolvedAction.params || [];
    const mapFromData: Record<string, string> = {};
    const rawData = (parsed?.data || '').toString();
    if (rawData.trim()) {
      for (const part of rawData.split(',')) {
        const seg = part.trim();
        if (!seg) continue;
        const eqIdx = seg.indexOf('=');
        if (eqIdx <= 0) continue;
        const n = seg.slice(0, eqIdx).trim();
        const v = seg.slice(eqIdx + 1).trim();
        if (n) mapFromData[n] = v;
      }
    }
    for (const p of params) {
      const name = p.name;
      if (argsFromBinding[name] != null) {
        paramArgs[name] = argsFromBinding[name];
      } else if (mapFromData[name] != null) {
        paramArgs[name] = mapFromData[name];
      } else {
        paramArgs[name] = '';
      }
    }

    let checkType: StepCheckRuleType | '' = '';
    let checkLocator = '';
    let checkExpectedUrl = '';
    let checkTimeout = '';

    if (binding && (binding as any).checkRule && typeof (binding as any).checkRule === 'object') {
      const rule = (binding as any).checkRule as StepCheckRule;
      if (
        rule.type === 'element-visible' ||
        rule.type === 'element-hidden' ||
        rule.type === 'url-contains' ||
        rule.type === 'url-equals'
      ) {
        checkType = rule.type;
      }
      if (
        rule.type === 'element-visible' ||
        rule.type === 'element-hidden'
      ) {
        checkLocator = (rule as any).locator || '';
      }
      if (rule.type === 'url-contains' || rule.type === 'url-equals') {
        checkExpectedUrl = (rule as any).expectedUrl || '';
      }
      if (rule.timeoutMs) {
        checkTimeout = String(rule.timeoutMs);
      }
    }

    setStepDialogPageKey(resolvedPage.key);
    setStepDialogActionKey(resolvedAction.key);
    setStepDialogArgs(paramArgs);
    setStepDialogExpected((parsed?.expected || '').toString());
    setStepDialogActionText((parsed?.action || '').toString());
    setStepDialogCheckType(checkType);
    setStepDialogCheckLocator(checkLocator);
    setStepDialogCheckExpectedUrl(checkExpectedUrl);
    setStepDialogCheckTimeoutMs(checkTimeout);
    setStepDialogOrder(order);
    setStepDialogOpen(true);
  };

  const handleMockSaveCase = async () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例');
      return;
    }
    const nextTitle = (editingTitle ?? selectedCase.title ?? '').trim();
    if (!nextTitle) {
      toast.error('标题不能为空');
      return;
    }
    const rawModule = (
      editingModule ??
      (selectedCase.module as string) ??
      'live-stream'
    ).trim();
    const nextModule = rawModule || 'live-stream';
    const rawSubmenu = (
      editingSubmenu ??
      (selectedCase.submenu as string) ??
      ''
    ).trim();
    const nextSubmenu = rawSubmenu || undefined;
    const rawPriority = (
      editingPriority ??
      (selectedCase.priority as string) ??
      ''
    ).trim();
    let nextPriority: 'P0' | 'P1' | 'P2' = selectedCase.priority || 'P1';
    if (rawPriority === 'P0' || rawPriority === 'P1' || rawPriority === 'P2') {
      nextPriority = rawPriority;
    }
    try {
      await updateCaseMeta({
        title: nextTitle,
        module: nextModule,
        submenu: nextSubmenu,
        priority: nextPriority,
      });
      setEditingTitle(null);
      setEditingSubmenu(null);
      setEditingPriority(null);
      setEditingModule(null);
    } catch {
      // updateCaseMeta 内部已经处理了 toast
    }
  };

  const handleDeleteStep = (stepId: string) => {
    if (!selectedCase) return;
    setStepsByCase((prev) => {
      const list = prev[selectedCase.id] || [];
      const next = list.filter((s) => s.id !== stepId);
      const normalized = next.map((s, index) => ({
        ...s,
        order: index + 1,
      }));
      return { ...prev, [selectedCase.id]: normalized };
    });
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) {
      toast.error('请先选择要删除的用户场景');
      return;
    }
    const confirmed = window.confirm(
      `确认删除选中的 ${selectedIds.length} 个用户场景？将同时删除其所有步骤。`,
    );
    if (!confirmed) return;
    const idsToDelete = selectedIds.slice();
    try {
      setDeletingBulk(true);
      for (const id of idsToDelete) {
        const res = await fetch(`${apiPrefix}/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const err = await normalizeResponseError(res as any);
          throw new Error(err.message || '删除用例失败');
        }
        setStepsByCase((prev) => {
          const { [id]: _removed, ...rest } = prev;
          return rest;
        });
      }
      if (selectedCaseId && idsToDelete.includes(selectedCaseId)) {
        setSelectedCaseId(null);
      }
      setSelectedIds([]);
      setTableSelectedKeys(new Set());
      toast.success(`已删除选中的 ${idsToDelete.length} 个用户场景`);
      await refreshCases();
    } catch (e: any) {
      toast.error(e?.message || '批量删除用例失败');
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleExportCases = () => {
    const rowsToExport = selectedIds.length
      ? filteredCases.filter((c) => selectedIds.includes(c.id))
      : filteredCases;
    if (!rowsToExport.length) {
      toast.message('暂无可导出的用户场景');
      return;
    }
    const headers = [
      'id',
      'code',
      'title',
      'module',
      'platform',
      'feature',
      'submenu',
      'priority',
      'status',
      'hasSteps',
      'hasCode',
      'description',
      'acceptanceCriteria',
      'generatedFilePath',
      'csvId',
    ];
    const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const safeModule = (m?: string | null) => (m ? moduleLabelMap[m] || m : '');
    const safeSubmenu = (s?: string | null) => (s ? SUBMENU_LABEL[s] || s : '');
    const lines = [headers.join(',')];
    for (const row of rowsToExport) {
      lines.push(
        [
          row.id,
          row.code,
          row.title,
          safeModule(row.module),
          row.platform || '',
          row.feature || '',
          safeSubmenu(row.submenu),
          row.priority ? PRIORITY_LABEL[row.priority] : '',
          STATUS_LABEL[row.status],
          row.hasSteps ? 'yes' : 'no',
          row.hasCode ? 'yes' : 'no',
          row.description || '',
          row.acceptanceCriteria || '',
          row.generatedFilePath || '',
          row.csvId || '',
        ]
          .map(esc)
          .join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}`;
    const plat = (platform || 'all').replace(/[^A-Za-z0-9_-]/g, '-') || 'all';
    const scope = selectedIds.length ? 'selected' : 'all';
    a.download = `scenarios.${plat}.${scope}.${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAssignSuite = async (suiteId: number | null) => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例');
      return;
    }
    const prevSuiteId = selectedSuiteId;
    const target = suiteId ? suites.find((s) => s.id === suiteId) : null;
    setSelectedSuiteId(suiteId);
    if (suiteId && target) {
      setSuitePreSteps(target.sharedPreSteps || []);
      setSuitePreStepDraft('');
      setSuiteDescDraft(target.description || '');
      setSuiteNameDraft(target.name || '');
    } else if (suiteId === null) {
      setSuitePreSteps([]);
      setSuitePreStepDraft('');
      setSuiteDescDraft('');
      setSuiteNameDraft('');
    }
    try {
      await updateCaseMeta({ suiteId });
      await loadSuites();
    } catch {
      // updateCaseMeta 已处理提示
      setSelectedSuiteId(prevSuiteId ?? null);
      if (prevSuiteId) {
        const prevSuite = suites.find((s) => s.id === prevSuiteId);
        setSuitePreSteps(prevSuite?.sharedPreSteps || []);
        setSuitePreStepDraft('');
        setSuiteDescDraft(prevSuite?.description || '');
      } else {
        setSuitePreSteps([]);
        setSuitePreStepDraft('');
        setSuiteDescDraft('');
      }
    }
  };

  const handleMoveSuitePreStep = (index: number, direction: 'up' | 'down') => {
    setSuitePreSteps((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      // 重新编号顺序字段
      const normalized = next.map((raw, idx) => {
        try {
          const parsed = JSON.parse(raw);
          return JSON.stringify({ ...parsed, order: idx + 1 });
        } catch {
          return JSON.stringify({ action: raw, order: idx + 1 });
        }
      });
      return normalized;
    });
  };

  const handleSaveSuitePreSteps = async () => {
    if (!selectedSuiteId) {
      toast.error('请选择一个套件');
      return;
    }
    const steps = suitePreSteps
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const actorsObject = suiteActorsDraft
      .map((row) => ({
        ...row,
        name: row.name.trim(),
        cookiesPath: row.cookiesPath.trim(),
      }))
      .filter((row) => !!row.name)
      .reduce<Record<string, any>>((acc, row) => {
        acc[row.name] = {
          scope: row.scope,
          auth:
            row.authMode === 'cookies'
              ? {
                  mode: 'cookies',
                  cookiesPath: row.cookiesPath || undefined,
                }
              : {
                  mode: 'ui',
                },
        };
        return acc;
      }, {});
    const defaultActorValue = suiteDefaultActorDraft.trim() || null;
    const payload = {
      name: suiteNameDraft || undefined,
      description: suiteDescDraft || null,
      sharedPreSteps: steps,
      actors: Object.keys(actorsObject).length ? actorsObject : null,
      defaultActor: defaultActorValue,
    };
    try {
      setSuiteSaving(true);
      const res = await fetch(`${apiPrefix}/suites/${selectedSuiteId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '保存套件失败');
      }
      const updated = (await res.json()) as UserScenarioSuiteSummary;
      const normalizedUpdated: UserScenarioSuiteSummary = {
        ...updated,
        caseCount:
          (updated as any).caseCount ??
          ((updated as any).cases?.length as number | undefined) ??
          updated.caseIds?.length ??
          0,
      };
      setSuites((prev) => {
        const others = prev.filter((s) => s.id !== normalizedUpdated.id);
        return [...others, normalizedUpdated].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });
      setSuitePreSteps(normalizedUpdated.sharedPreSteps || []);
      setSuitePreStepDraft('');
      setSuiteDescDraft(normalizedUpdated.description || '');
      setSuiteNameDraft(normalizedUpdated.name || '');
      const actorsObj =
        normalizedUpdated.actors && typeof normalizedUpdated.actors === 'object'
          ? normalizedUpdated.actors
          : null;
      const nextActors: SuiteActorDraft[] = actorsObj
        ? Object.entries(actorsObj)
            .map(([name, opt]) => {
              const rec: any = opt && typeof opt === 'object' ? opt : {};
              const auth: any =
                rec.auth && typeof rec.auth === 'object' ? rec.auth : {};
              const mode: SuiteActorDraft['authMode'] =
                auth.mode === 'cookies' ? 'cookies' : 'ui';
              const scope: SuiteActorDraft['scope'] =
                rec.scope === 'test' ? 'test' : 'suite';
              return {
                name: String(name || ''),
                scope,
                authMode: mode,
                cookiesPath:
                  mode === 'cookies' ? String(auth.cookiesPath || '') : '',
              };
            })
            .filter((r) => !!r.name.trim())
        : [];
      setSuiteActorsDraft(nextActors);
      setSuiteDefaultActorDraft(
        normalizedUpdated.defaultActor
          ? String(normalizedUpdated.defaultActor)
          : '',
      );
      toast.success('已保存套件信息');
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '保存套件失败');
      }
    } finally {
      setSuiteSaving(false);
    }
  };

  const handleCreateSuite = async () => {
    if (!newSuiteName.trim()) {
      toast.error('请填写套件名称');
      return;
    }
    try {
      setSuiteSaving(true);
      const res = await fetch(`${apiPrefix}/suites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newSuiteName.trim(),
          description: newSuiteDesc.trim() || undefined,
          platform: selectedCase?.platform || platform || 'gettr-web',
          module: selectedCase?.module || 'live-stream',
          sharedPreSteps: [],
        }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '创建套件失败');
      }
      const created = (await res.json()) as UserScenarioSuiteSummary;
      const normalizedCreated: UserScenarioSuiteSummary = {
        ...created,
        caseCount:
          (created as any).caseCount ??
          ((created as any).cases?.length as number | undefined) ??
          created.caseIds?.length ??
          0,
      };
      setSuites((prev) => [...prev, normalizedCreated]);
      setNewSuiteName('');
      setNewSuiteDesc('');
      setSuiteDialogOpen(false);
      if (selectedCase) {
        await handleAssignSuite(created.id);
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '创建套件失败');
      }
    } finally {
      setSuiteSaving(false);
    }
  };

  const handleGenerateSuiteCodeInternal = async (suiteId: number) => {
    const targetSuite = suites.find((s) => s.id === suiteId);
    const suiteCaseCount =
      (targetSuite?.caseCount as number | undefined) ??
      targetSuite?.caseIds?.length ??
      0;
    if (suiteCaseCount === 0) {
      toast.error('当前套件尚未包含任何用例');
      return;
    }
    try {
      setSuiteGenerating(true);
      const res = await fetch(
        `${apiPrefix}/suites/${suiteId}/generate-code`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '生成套件代码失败');
      }
      const data = await res.json();
      const filePath = (data?.filePath as string) || '';
      if (filePath) {
        try {
          localStorage.setItem('gtt:testcases:lastFile', filePath);
          localStorage.setItem('gtt:testcases:forceReload', '1');
        } catch {}
        const href = `/testcases${filePath ? `?file=${encodeURIComponent(filePath)}` : ''}`;
        let toastId: string | number | undefined;
        const handleOpen = () => {
          try {
            router.push(href);
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.href = href;
              }
            }, 200);
          } catch {
            if (typeof window !== 'undefined') {
              window.location.href = href;
            }
          }
          if (toastId !== undefined) {
            try {
              toast.dismiss(toastId);
            } catch {}
          }
        };
        toastId = toast.success(
          <div className="pointer-events-auto flex flex-col gap-1">
            <div className="break-all text-xs">套件代码已生成：</div>
            <div className="break-all font-mono text-[11px]">{filePath}</div>
            <div className="mt-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpen();
                }}
              >
                在「Testcases」页面中打开
              </Button>
            </div>
          </div>,
          { closeButton: true, duration: 8000 },
        );
      } else {
        toast.success(data?.message || '已生成套件代码');
      }
      await refreshCases();
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '生成套件代码失败');
      }
    } finally {
      setSuiteGenerating(false);
    }
  };

  const handleDeleteSuite = async () => {
    if (!selectedSuiteId) {
      toast.error('请选择一个套件');
      return;
    }
    const target = suites.find((s) => s.id === selectedSuiteId);
    const confirmed = window.confirm(
      `确认删除套件「${target?.name || selectedSuiteId}」？\n套件下的用例将不再关联该套件。`
    );
    if (!confirmed) return;
    try {
      setSuiteDeleting(true);
      const res = await fetch(`${apiPrefix}/suites/${selectedSuiteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '删除套件失败');
      }
      setSuites((prev) => prev.filter((s) => s.id !== selectedSuiteId));
      setSelectedSuiteId(null);
      setSuitePreSteps([]);
      setSuitePreStepDraft('');
      setSuiteDescDraft('');
      setSuiteNameDraft('');
      if (selectedCase?.suiteId === selectedSuiteId) {
        await updateCaseMeta({ suiteId: null });
      } else {
        await refreshCases();
      }
      toast.success('套件已删除');
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '删除套件失败');
      }
    } finally {
      setSuiteDeleting(false);
    }
  };

  const handleGenerateSuiteCode = async () => {
    if (!selectedSuiteId) {
      toast.error('请选择套件');
      return;
    }
    await handleGenerateSuiteCodeInternal(selectedSuiteId);
  };

  const getStepParamHint = (
    step: UserScenarioStep,
  ): { summary: string; example: string } | null => {
    if (!actionCatalog || !step.binding) return null;
    let parsed: StepBindingV1 | null = null;
    try {
      parsed = JSON.parse(step.binding) as StepBindingV1;
    } catch {
      return null;
    }
    if (!parsed || !parsed.pageKey || !parsed.actionKey) return null;
    const page = (actionCatalog.pages || []).find(
      (p) => p.key === parsed!.pageKey,
    );
    if (!page) return null;
    const action = (page.actions || []).find(
      (a) => a.key === parsed!.actionKey,
    );
    if (!action) return null;
    const params = action.params || [];
    if (!params.length) return null;
    const parts = params.map((p) => {
      const type = (p.type || 'string').toString();
      return `${p.name}(${type})`;
    });
    const example = params.map((p) => `${p.name}=...`).join(', ');
    return {
      summary: parts.join(', '),
      example,
    };
  };


  const handleEditStepInDialog = (stepId: string) => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例');
      return;
    }
    const plat = (selectedCase.platform || platform || '')
      .toString()
      .toLowerCase();
    const isApiPlatform = plat.includes('-api-');
    const list = stepsByCase[selectedCase.id] || [];
    const step = list.find((s) => s.id === stepId);
    if (!step) return;

    // 对于 API 平台（如 gettr-api-*），不依赖页面动作目录，直接编辑步骤文本
    if (isApiPlatform) {
      // 解析 data 字段中的简单 key=value 对，支持 method/path/body
      let method = 'GET';
      let pathVal = '';
      let bodyVal = '';
      const rawData = (step.data || '').toString();
      if (rawData.trim()) {
        for (const part of rawData.split(',')) {
          const seg = part.trim();
          if (!seg) continue;
          const eqIdx = seg.indexOf('=');
          if (eqIdx <= 0) continue;
          const name = seg.slice(0, eqIdx).trim().toLowerCase();
          const value = seg.slice(eqIdx + 1).trim();
          if (name === 'method') {
            method = value || method;
          } else if (name === 'path') {
            pathVal = value;
          } else if (name === 'body' || name === 'payload') {
            bodyVal = value;
          }
        }
      }
      setEditingStepIdForDialog(stepId);
      setStepDialogPageKey(undefined);
      setStepDialogActionKey(undefined);
      setStepDialogArgs({});
      setStepDialogExpected(step.expected || '');
      setStepDialogActionText(step.action || '');
      setStepDialogCheckType('');
      setStepDialogCheckLocator('');
      setStepDialogCheckExpectedUrl('');
      setStepDialogCheckTimeoutMs('');
      setStepDialogOrder(Number.isFinite(step.order) ? step.order : 1);
      setStepDialogApiMethod(method || 'GET');
      setStepDialogApiPath(pathVal);
      setStepDialogApiBody(bodyVal);
      setStepDialogOpen(true);
      return;
    }

    if (!actionCatalog || !actionCatalog.pages?.length) {
      toast.error('页面动作目录尚未加载，无法使用绑定编辑');
      return;
    }

    let binding: StepBindingV1 | null = null;
    try {
      if (step.binding) {
        binding = JSON.parse(step.binding) as StepBindingV1;
      }
    } catch {
      binding = null;
    }
    const catalog = actionCatalog;
    let pageKey: string | undefined;
    let actionKey: string | undefined;
    let argsFromBinding: Record<string, string> = {};

    if (binding && binding.pageKey && binding.actionKey) {
      pageKey = binding.pageKey;
      actionKey = binding.actionKey;
      if (Array.isArray(binding.args)) {
        for (const arg of binding.args) {
          if (!arg || !arg.name) continue;
          argsFromBinding[arg.name] = arg.value ?? '';
        }
      }
    }

    const pages = catalog.pages || [];
    const resolvedPage =
      (pageKey && pages.find((p) => p.key === pageKey)) || pages[0] || null;

    const resolvedAction =
      resolvedPage &&
      ((actionKey && resolvedPage.actions.find((a) => a.key === actionKey)) ||
        resolvedPage.actions[0] ||
        null);

    if (!resolvedPage || !resolvedAction) {
      toast.error('当前步骤未绑定到可解析的页面/动作，请重新选择');
      setEditingStepIdForDialog(null);
      setStepDialogPageKey(pages[0]?.key);
      setStepDialogActionKey(undefined);
      setStepDialogArgs({});
      setStepDialogExpected(step.expected || '');
      setStepDialogOrder(Number.isFinite(step.order) ? step.order : 1);
      setStepDialogOpen(true);
      return;
    }

    const paramArgs: Record<string, string> = {};
    const params = resolvedAction.params || [];
    // 先用 binding.args，缺失的尝试从 data 文本中回填
    const mapFromData: Record<string, string> = {};
    const rawData = (step.data || '').toString();
    if (rawData.trim()) {
      for (const part of rawData.split(',')) {
        const seg = part.trim();
        if (!seg) continue;
        const eqIdx = seg.indexOf('=');
        if (eqIdx <= 0) continue;
        const n = seg.slice(0, eqIdx).trim();
        const v = seg.slice(eqIdx + 1).trim();
        if (n) mapFromData[n] = v;
      }
    }
    for (const p of params) {
      const name = p.name;
      if (argsFromBinding[name] != null) {
        paramArgs[name] = argsFromBinding[name];
      } else if (mapFromData[name] != null) {
        paramArgs[name] = mapFromData[name];
      } else {
        paramArgs[name] = '';
      }
    }

    let checkType: StepCheckRuleType | '' = '';
    let checkLocator = '';
    let checkExpectedUrl = '';
    let checkTimeout = '';

    if (
      binding &&
      (binding as any).checkRule &&
      typeof (binding as any).checkRule === 'object'
    ) {
      const rule = (binding as any).checkRule as StepCheckRule;
      if (
        rule.type === 'element-visible' ||
        rule.type === 'element-hidden' ||
        rule.type === 'url-contains' ||
        rule.type === 'url-equals'
      ) {
        checkType = rule.type;
      }
      if (typeof rule.locator === 'string') {
        checkLocator = rule.locator;
      }
      if (typeof rule.expectedUrl === 'string') {
        checkExpectedUrl = rule.expectedUrl;
      }
      if (
        typeof rule.timeoutMs === 'number' &&
        Number.isFinite(rule.timeoutMs) &&
        rule.timeoutMs > 0
      ) {
        checkTimeout = String(rule.timeoutMs);
      }
    }

    if (!checkType && resolvedAction.kind === 'assert') {
      const locRaw = (resolvedAction as any).locator as
        | string
        | null
        | undefined;
      if (locRaw && locRaw.trim()) {
        checkType = 'element-visible';
        checkLocator = locRaw.trim();
      }
    }

    setEditingStepIdForDialog(stepId);
    setStepDialogPageKey(resolvedPage.key);
    setStepDialogActionKey(resolvedAction.key);
    setStepDialogArgs(paramArgs);
    setStepDialogExpected(
      step.expected || resolvedAction.defaultExpected || '',
    );
    setStepDialogActionText(step.action || '');
    setStepDialogCheckType(checkType);
    setStepDialogCheckLocator(checkLocator);
    setStepDialogCheckExpectedUrl(checkExpectedUrl);
    setStepDialogCheckTimeoutMs(checkTimeout);
    setStepDialogOpen(true);
  };

  const refreshCases = useCallback(async () => {
    try {
      setLoadingCases(true);
      const qs = new URLSearchParams();
      if (platform) qs.set('platform', platform);
      const res = await fetch(`${apiPrefix}?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '获取用例列表失败');
      }
      const data = (await res.json()) as UserScenarioSummary[];
      setCases(data || []);
      if (!selectedCaseId && data.length) {
        setSelectedCaseId(data[0].id);
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取用例列表失败');
      }
    } finally {
      setLoadingCases(false);
    }
  }, [apiPrefix, platform, router, selectedCaseId]);

  const handleDeleteCase = useCallback(async (id: number) => {
    const confirmed = window.confirm(
      '确认删除该用户场景？将同时删除其所有步骤。',
    );
    if (!confirmed) return;
    try {
      setDeletingId(id);
      const res = await fetch(`${apiPrefix}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '删除用例失败');
      }
      setStepsByCase((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
      if (selectedCaseId === id) {
        setSelectedCaseId(null);
      }
      setTableSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(`id:${id}`);
        return next;
      });
      toast.success('已删除该用户场景');
      await refreshCases();
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '删除用例失败');
      }
    } finally {
      setDeletingId((curr) => (curr === id ? null : curr));
    }
  }, [apiPrefix, refreshCases, router, selectedCaseId]);


  const handleMoveStep = (id: string, direction: 'up' | 'down') => {
    setStepsByCase((prev) => {
      if (!selectedCase) return prev;
      const caseId = selectedCase.id;
      const list = prev[caseId] || [];
      const idx = list.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;
      const next = [...list];
      const tmp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = tmp;
      const reOrdered = next.map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, [caseId]: reOrdered };
    });
  };

const handleSaveSteps = async () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例');
      return;
    }
  
    const steps = currentSteps.map((s) => {
      let nextBinding = s.binding;
      if (nextBinding) {
        try {
          const parsed = JSON.parse(nextBinding) as StepBindingV1;
          if (parsed && Array.isArray(parsed.args)) {
            const map: Record<string, string> = {};
            const raw = (s.data || '').toString();
            if (raw.trim()) {
              for (const part of raw.split(',')) {
                const seg = part.trim();
                if (!seg) continue;
                const eqIdx = seg.indexOf('=');
                if (eqIdx <= 0) continue;
                const name = seg.slice(0, eqIdx).trim();
                const value = seg.slice(eqIdx + 1).trim();
                if (name) {
                  map[name] = value;
                }
              }
            }
            if (Object.keys(map).length) {
              parsed.args = parsed.args.map((arg) => ({
                ...arg,
                value: map[arg.name] ?? arg.value ?? '',
              }));
            }
          }
          nextBinding = JSON.stringify(parsed);
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
      };
    });
    try {
      const res = await fetch(`${apiPrefix}/${selectedCase.id}/steps`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '保存步骤失败');
      }
      toast.success('已保存步骤');
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '保存步骤失败');
      }
    }
  };

  const openEnvTemplateDialogForCase = useCallback(async (
    caseId: number,
    casePlatform?: string | null,
  ) => {
    const rawPlatform = (casePlatform || platform || 'gettr-web')
      .toString()
      .trim();
    const p = rawPlatform || 'gettr-web';
    const d: 'browser' | 'android' | 'ios' | 'other' =
      p === 'gettr-android'
        ? 'android'
        : p.includes('-api-')
          ? 'other'
          : 'browser';
    setEnvDialogCaseId(caseId);
    setEnvDialogPlatform(p);
    setEnvDialogDriver(d);
    setEnvDialogSelectedId('none');
    setEnvDialogOpen(true);
    setEnvDialogLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('platform', p);
      qs.set('driver', d);
      const res = await fetch(`/api/env-templates?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '加载环境模板失败');
      }
      const data = await res.json();
      const list: any[] = Array.isArray(data?.items) ? data.items : [];
      const mapped: EnvTemplateSummary[] = list.map((it) => ({
        id: Number(it.id),
        platform: String(it.platform || p),
        driver: (it.driver || d) as 'browser' | 'android' | 'ios' | 'other',
        key: String(it.key || ''),
        name: String(it.name || it.key || ''),
        description: (it.description as string | null | undefined) ?? null,
      }));
      setEnvDialogTemplates(mapped);
      if (mapped.length === 1) {
        setEnvDialogSelectedId(mapped[0]!.id);
      } else if (mapped.length > 1) {
        try {
          const key = getEnvTemplateStorageKey(p, d);
          const raw = localStorage.getItem(key);
          if (raw) {
            const lastId = Number(raw);
            if (
              Number.isFinite(lastId) &&
              mapped.some((tpl) => tpl.id === lastId)
            ) {
              setEnvDialogSelectedId(lastId);
            }
          }
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '加载环境模板失败');
      }
      setEnvDialogTemplates([]);
    } finally {
      setEnvDialogLoading(false);
    }
  }, [platform, router]);

  const generateCodeForCase = async (
    caseId: number,
    envTemplateId?: number | null,
    opts?: { silent?: boolean },
  ): Promise<string | null> => {
    try {
      const res = await fetch(`${apiPrefix}/${caseId}/generate-code`, {
        method: 'POST',
        headers: envTemplateId
          ? { 'content-type': 'application/json' }
          : undefined,
        body: envTemplateId ? JSON.stringify({ envTemplateId }) : undefined,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '生成代码失败');
      }
      const data = await res.json();
      const filePath = (data?.filePath as string) || '';
      if (!opts?.silent) {
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
                    router.push('/testcases');
                  }}
                >
                  在「用例库」中打开
                </Button>
              </div>
            </div>,
          );
        } else {
          toast.success(data?.message || '已触发代码生成');
        }
      }
      try {
        if (filePath) {
          localStorage.setItem('gtt:testcases:lastFile', filePath);
          localStorage.setItem('gtt:testcases:forceReload', '1');
        }
      } catch {}
      await refreshCases();
      return filePath || null;
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '生成代码失败');
      }
      return null;
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedCase) {
      toast.error('请先在左侧选择一个用例');
      return;
    }
    if (selectedCase.suiteId) {
      const suiteName = selectedCase.suiteName || `套件 #${selectedCase.suiteId}`;
      const ok = window.confirm(
        `用例 ${selectedCase.code} 已加入套件「${suiteName}」。\n需要生成套件文件以包含此用例的代码，是否继续生成套件代码？`,
      );
      if (!ok) return;
      await handleGenerateSuiteCodeInternal(selectedCase.suiteId);
      return;
    }
    await openEnvTemplateDialogForCase(
      selectedCase.id,
      selectedCase.platform || platform,
    );
  };

  const enqueueRunTasks = useCallback(
    (ids: number[]) => {
      if (!ids.length) {
        toast.error('请选择需要运行的用例');
        return;
      }
      const tasks: RunTask[] = ids.map((id) => {
        const found = cases.find((c) => c.id === id);
        return {
          id,
          title: found ? `${found.code} ${found.title}` : `用例 #${id}`,
          status: 'pending',
          filePath: found?.generatedFilePath ?? null,
        };
      });
      setRunQueue((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const filtered = prev.filter((t) => !ids.includes(t.id) || t.status === 'running');
        const next = [...filtered];
        tasks.forEach((t) => {
          if (existingIds.has(t.id)) {
            next.push({ ...t });
          } else {
            next.push(t);
          }
        });
        return next;
      });
      setLogPanelOpen(true);
    },
    [cases],
  );

  const startRunTask = useCallback(
    async (caseId: number) => {
      const target = cases.find((c) => c.id === caseId);
      if (!target) {
        setRunQueue((prev) =>
          prev.map((t) =>
            t.id === caseId ? { ...t, status: 'failed', error: '用例不存在' } : t,
          ),
        );
        setRunningCaseId(null);
        return;
      }
      setRunningCaseId(caseId);
      setSocketRunning(true);
      clearLogs();
      setLogPanelOpen(true);
      setRunQueue((prev) =>
        prev.map((t) => (t.id === caseId ? { ...t, status: 'running', error: null } : t)),
      );

      try {
        let filePath = (target.generatedFilePath || '').trim();
        if (!filePath || target.status !== 'code_generated') {
          filePath =
            (await generateCodeForCase(caseId, undefined, { silent: true })) || '';
        }
        if (!filePath) {
          throw new Error('未能生成用例代码');
        }

        setRunQueue((prev) =>
          prev.map((t) => (t.id === caseId ? { ...t, filePath } : t)),
        );

        let envConfig: any = undefined;
        if (runEnvSelectedId && runEnvSelectedId !== 'none' && runEnvTemplates.length) {
          const tpl = runEnvTemplates.find((t) => String(t.id) === String(runEnvSelectedId));
          if (tpl && tpl.config && typeof tpl.config === 'object') {
            const driverForTpl =
              tpl.driver ||
              inferDriverFromPlatform((target.platform || platform || 'gettr-web') as string);
            if (driverForTpl === 'android') {
              envConfig = { android: tpl.config };
            } else if (driverForTpl === 'ios') {
              envConfig = { ios: tpl.config };
            } else {
              envConfig = { browser: tpl.config };
            }
          }
        }

        const csrfResp = await fetch(`/api/csrf-token`, { credentials: 'include' });
        const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null;
        const csrfToken = csrf?.token;
        const resp = await fetch(`/api/testcase/runpath`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          body: JSON.stringify({
            filePath,
            clientId,
            keepAppOpen: true,
            shareSession: true,
            envConfig,
          }),
        });
        if (!resp.ok) {
          const err = await normalizeResponseError(resp as any);
          throw new Error(err?.message || '触发运行失败');
        }
        toast.message(`已开始运行：${target.code}`);
      } catch (err: any) {
        setRunQueue((prev) =>
          prev.map((t) =>
            t.id === caseId
              ? { ...t, status: 'failed', error: err?.message || '运行失败' }
              : t,
          ),
        );
        setRunningCaseId(null);
        setSocketRunning(false);
      }
    },
    [cases, clearLogs, clientId, generateCodeForCase, runEnvSelectedId, runEnvTemplates, platform, setSocketRunning],
  );

  useEffect(() => {
    if (runningCaseId !== null) return;
    const next = runQueue.find((t) => t.status === 'pending');
    if (!next) return;
    void startRunTask(next.id);
  }, [runQueue, runningCaseId, startRunTask]);

  useEffect(() => {
    if (runningCaseId === null) return;
    if (socketRunning) return;
    setRunQueue((prev) =>
      prev.map((t) =>
        t.id === runningCaseId && t.status === 'running'
          ? { ...t, status: 'success' }
          : t,
      ),
    );
    setRunningCaseId(null);
  }, [socketRunning, runningCaseId]);

  const handleRunCase = useCallback(
    (id: number) => {
      enqueueRunTasks([id]);
    },
    [enqueueRunTasks],
  );

  const handleRunSelected = useCallback(() => {
    if (!selectedIds.length) {
      toast.error('请先勾选需要运行的用例');
      return;
    }
    enqueueRunTasks(selectedIds);
  }, [enqueueRunTasks, selectedIds]);

  const handleSelectRunEnv = useCallback(
    (val: string) => {
      setRunEnvSelectedId(val);
      const driver = inferDriverFromPlatform(platform);
      try {
        localStorage.setItem(getRunEnvStorageKey(platform, driver), val);
      } catch {
        // ignore
      }
    },
    [platform],
  );

  const fetchActionCatalog = async () => {
    try {
      setLoadingCatalog(true);
      const res = await fetch(
        `${apiPrefix}/action-catalog?platform=${encodeURIComponent(platform || 'gettr-web')}`,
        {
          cache: 'no-store',
        },
      );
      await ensureResponseOk(res, {
        defaultMessage: '获取页面动作目录失败',
        onUnauthorized: () => {
          try {
            router.push('/signin');
          } catch {
            // ignore navigation errors
          }
        },
      });
      const data = await res.json();
      const catalog: ActionCatalog | null =
        (data && (data.catalog as ActionCatalog)) ||
        (data?.platform ? (data as ActionCatalog) : null);
      if (catalog && Array.isArray(catalog.pages)) {
        setActionCatalog(catalog);
      }
    } catch (e: any) {
      // 加载失败不影响主流程；鉴权错误已跳转登录页，不再打印
      if (isUnauthorizedError(e)) {
        return;
      }
      // 其它错误仅在控制台提示，避免打断主流程
      console.error(e?.message || e);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const updateCaseMeta = async (patch: {
    title?: string;
    status?: CaseStatus;
    submenu?: string;
    priority?: 'P0' | 'P1' | 'P2';
    module?: string;
    platform?: string;
    suiteId?: number | null;
  }) => {
    if (!selectedCase) {
      toast.error('请先选择一个用例');
      return;
    }
    try {
      const res = await fetch(`${apiPrefix}/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '更新用例失败');
      }
      await refreshCases();
      toast.success('已更新用例信息');
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '更新用例失败');
      }
    }
  };

  const loadCaseSteps = async (caseId: number) => {
    try {
      const res = await fetch(`${apiPrefix}/${caseId}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '获取用例详情失败');
      }
      const data = await res.json();
      const steps: UserScenarioStep[] = (data?.steps || []).map((s: any) => ({
        id: String(s.id),
        order: s.order,
        action: s.action || '',
        data: s.data || '',
        expected: s.expected || '',
        binding: s.binding || '',
      }));
      setStepsByCase((prev) => ({ ...prev, [caseId]: steps }));
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取用例详情失败');
      }
    }
  };

  useEffect(() => {
    void refreshCases();
    void fetchActionCatalog();
    void loadSuites();
  }, [platform]);

  const loadPlatforms = async () => {
    try {
      const res = await fetch('/api/action-catalog/platforms', {
        cache: 'no-store',
      });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const optsBase: OptionsSelectItem<string>[] = items.map((p: any) => ({
        value: p.key as string,
        label: (p.label as string) || (p.key as string),
      }));
      const hasApiLivestream = optsBase.some(
        (p) => p.value === 'gettr-api-livestream',
      );
      const opts: OptionsSelectItem<string>[] = hasApiLivestream
        ? optsBase
        : optsBase.concat([
            {
              value: 'gettr-api-livestream',
              label: 'GETTR API (Livestream)',
            },
          ]);
      setPlatforms(opts);
      if (!platform && opts.length) {
        const def =
          opts.find((p) => p.value === 'gettr-web')?.value ||
          opts[0]?.value ||
          'gettr-web';
        setPlatform(def);
      }
    } catch {
      // ignore
    }
  };

  const loadSuites = async () => {
    try {
      setSuiteLoading(true);
      const qs = platform ? `?platform=${encodeURIComponent(platform)}` : '';
      const res = await fetch(`${apiPrefix}/suites${qs}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || '获取套件列表失败');
      }
      const data = await res.json();
      const itemsRaw: UserScenarioSuiteSummary[] = Array.isArray(data)
        ? data
        : [];
      const mapped = itemsRaw.map((s) => ({
        ...s,
        sharedPreSteps: (s.sharedPreSteps || []).map((p) =>
          (p || '').toString(),
        ),
        caseCount:
          (s as any).caseCount ??
          ((s as any).cases?.length as number | undefined) ??
          s.caseIds?.length ??
          0,
      }));
      setSuites(mapped);
    } catch (e: any) {
      if (!isUnauthorizedError(e)) {
        toast.error(e?.message || '获取套件列表失败');
      }
    } finally {
      setSuiteLoading(false);
    }
  };

  useEffect(() => {
    void loadPlatforms();
  }, []);

  useEffect(() => {
    const loadRunTemplates = async () => {
      const driver = inferDriverFromPlatform(platform);
      setRunEnvTemplates([]);
      setRunEnvSelectedId('none');
      try {
        const qs = new URLSearchParams();
        if (platform) qs.set('platform', platform);
        qs.set('driver', driver);
        const res = await fetch(`/api/env-templates?${qs.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          setRunEnvTemplates([]);
          return;
        }
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        const mapped: EnvTemplateSummary[] = items.map((it: any) => {
          let cfg: any = {};
          try {
            cfg =
              it.config && typeof it.config === 'string'
                ? JSON.parse(it.config)
                : it.config || {};
          } catch {
            cfg = {};
          }
          return {
            id: Number(it.id),
            platform: String(it.platform || platform || 'gettr-web'),
            driver: (it.driver || driver) as any,
            key: String(it.key || ''),
            name: String(it.name || it.key || ''),
            description: (it.description as string | null | undefined) ?? null,
            config: cfg,
          };
        });
        setRunEnvTemplates(mapped);
        if (mapped.length === 1) {
          setRunEnvSelectedId(String(mapped[0]!.id));
        } else if (mapped.length > 1) {
          try {
            const raw = localStorage.getItem(getRunEnvStorageKey(platform, driver));
            if (raw) {
              if (mapped.some((tpl) => String(tpl.id) === raw)) {
                setRunEnvSelectedId(raw);
              }
            }
          } catch {
            // ignore
          }
        }
      } catch {
        setRunEnvTemplates([]);
      }
    };
    void loadRunTemplates();
  }, [platform]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const kinds: Array<'module' | 'submenu' | 'priority'> = [
          'module',
          'submenu',
          'priority',
        ];
        for (const kind of kinds) {
          const res = await fetch(`${apiPrefix}/options?kind=${kind}`, {
            cache: 'no-store',
          });
          if (!res.ok) continue;
          const data = await res.json();
          const items: OptionsSelectItem<string>[] = Array.isArray(data?.items)
            ? data.items
            : [];
          if (kind === 'module') {
            setModuleItems(items);
          } else if (kind === 'submenu') {
            setSubmenuItems(items);
          } else if (kind === 'priority') {
            const casted = items.map(
              (it) =>
                ({
                  value: (it.value as 'P0' | 'P1' | 'P2') ?? 'P1',
                  label: it.label,
                }) as OptionsSelectItem<'P0' | 'P1' | 'P2'>,
            );
            setPriorityItems(
              casted.length
                ? casted
                : [
                    { value: 'P0', label: 'P0' },
                    { value: 'P1', label: 'P1' },
                    { value: 'P2', label: 'P2' },
                  ],
            );
          }
        }
        if (!priorityItems.length) {
          setPriorityItems([
            { value: 'P0', label: 'P0' },
            { value: 'P1', label: 'P1' },
            { value: 'P2', label: 'P2' },
          ]);
        }
      } catch {
        // ignore
      }
    };
    void loadOptions();
  }, []);

  const handleCreateCase = async () => {
    if (!newCaseCode.trim()) {
      toast.error('用例编号不能为空');
      return;
    }
    if (!newCaseTitle.trim()) {
      toast.error('标题不能为空');
      return;
    }
    try {
      setNewCaseSubmitting(true);
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
      };
      const res = await fetch(apiPrefix, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        throw new Error(err.message || '创建用户场景失败');
      }
      const created = (await res.json()) as UserScenarioSummary;
      toast.success('已创建用户场景');
      setNewCaseOpen(false);
      await refreshCases();
      if (created?.id) {
        setSelectedCaseId(created.id);
      }
    } catch (e: any) {
      toast.error(e?.message || '创建用户场景失败');
    } finally {
      setNewCaseSubmitting(false);
    }
  };

  const handlePlatformChange = (value: string) => {
    setPlatform(value);
    try {
      localStorage.setItem('gtt:scenarios:platform', value);
    } catch {
      // ignore
    }
    setSelectedCaseId(null);
    setStepsByCase({});
  };

  const handleUploadCsvFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('platform', platform || 'gettr-web');
      const res = await fetch(`${apiPrefix}/sync-from-csv-upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        throw new Error(err.message || '上传 CSV 失败');
      }
      const data = await res.json();
      toast.success(
        data?.message ||
          `导入完成：新增 ${data?.created ?? 0} 条，更新 ${data?.updated ?? 0} 条`,
      );
      await refreshCases();
    } catch (e: any) {
      toast.error(e?.message || '上传 CSV 失败');
    }
  };

  const handleUploadDocFile = async (file: File) => {
    setIngestingDoc(true);
    const toastAny = toast as any;
    let progressId: any = null;
    let refreshId: any = null;
    if (toastAny) {
      progressId =
        toastAny.message?.(
          '步骤 1/2：已上传用例说明表（CSV/文档），正在解析生成用户场景，这一步通常需要 10～60 秒，请稍候…',
          { duration: 120000 },
        ) ??
        toastAny(
          '步骤 1/2：已上传用例说明表（CSV/文档），正在解析生成用户场景，这一步通常需要 10～60 秒，请稍候…',
          { duration: 120000 },
        );
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project', 'live-stream');
      formData.append('docType', 'livekit');
      formData.append('sourceDoc', file.name || 'livekit');
      formData.append('platform', platform || 'gettr-web');
      if (docAiPromptText && docAiPromptText.trim()) {
        formData.append('aiHint', docAiPromptText.trim());
      }
      const res = await fetch(`${apiPrefix}/ingest-doc-upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res as any);
        throw new Error(err.message || '从说明文档导入失败');
      }
      if (progressId != null && toastAny?.dismiss) {
        toastAny.dismiss(progressId);
        progressId = null;
      }
      if (toastAny) {
        refreshId =
          toastAny.message?.(
            '步骤 2/2：解析完成，正在写入用户场景并刷新列表…',
            { duration: 60000 },
          ) ??
          toastAny(
            '步骤 2/2：解析完成，正在写入用户场景并刷新列表…',
            {
              duration: 60000,
            },
          );
      }
      const data = await res.json();
      await refreshCases();
      if (refreshId != null && toastAny?.dismiss) {
        toastAny.dismiss(refreshId);
        refreshId = null;
      }
      toast.success(
        data?.message ||
          `从说明文档导入完成：新增 ${data?.created ?? 0} 条，更新 ${data?.updated ?? 0} 条`,
      );
    } catch (e: any) {
      toast.error(e?.message || '从说明文档导入失败');
    } finally {
      setIngestingDoc(false);
      if (progressId != null && toastAny?.dismiss) {
        toastAny.dismiss(progressId);
      }
      if (refreshId != null && toastAny?.dismiss) {
        toastAny.dismiss(refreshId);
      }
    }
  };

  return {
    handleMoveSuitePreStep,
    STATUS_LABEL,
    PRIORITY_LABEL,
    SUBMENU_LABEL,
    cases,
    loadingCases,
    stepsByCase,
    selectedCaseId,
    setSelectedCaseId,
    deletingId,
    deletingBulk,
    ingestingDoc,
    setIngestingDoc,
    selectedIds,
    setSelectedIds,
    metaOpen,
    setMetaOpen,
    detailsOpen,
    setDetailsOpen,
    metaDialogOpen,
    setMetaDialogOpen,
    tablePage,
    setTablePage,
    tablePageSize,
    setTablePageSize,
    tableSelectedKeys,
    setTableSelectedKeys,
    tableTotalRows,
    setTableTotalRows,
    tableFilteredRows,
    setTableFilteredRows,
    actionCatalog,
    setActionCatalog,
    loadingCatalog,
    setLoadingCatalog,
    stepDialogOpen,
    setStepDialogOpen,
    stepDialogPageKey,
    setStepDialogPageKey,
    stepDialogActionKey,
    setStepDialogActionKey,
    stepDialogArgs,
    setStepDialogArgs,
    stepDialogExpected,
    setStepDialogExpected,
    stepDialogActionText,
    setStepDialogActionText,
    stepDialogCheckType,
    setStepDialogCheckType,
    stepDialogCheckLocator,
    setStepDialogCheckLocator,
    stepDialogCheckExpectedUrl,
    setStepDialogCheckExpectedUrl,
    stepDialogCheckTimeoutMs,
    setStepDialogCheckTimeoutMs,
    editingStepIdForDialog,
    setEditingStepIdForDialog,
    stepDialogOrder,
    setStepDialogOrder,
    stepDialogApiMethod,
    setStepDialogApiMethod,
    stepDialogApiPath,
    setStepDialogApiPath,
    stepDialogApiBody,
    setStepDialogApiBody,
    stepDialogTarget,
    setStepDialogTarget,
    envDialogOpen,
    setEnvDialogOpen,
    envDialogLoading,
    envDialogTemplates,
    envDialogCaseId,
    envDialogSelectedId,
    setEnvDialogSelectedId,
    envDialogPlatform,
    envDialogDriver,
    docAiPromptOpen,
    setDocAiPromptOpen,
    docAiPromptText,
    setDocAiPromptText,
    platform,
    setPlatform,
    platforms,
    setPlatforms,
    newCaseOpen,
    setNewCaseOpen,
    newCaseSubmitting,
    newCaseCode,
    setNewCaseCode,
    newCaseTitle,
    setNewCaseTitle,
    newCaseFeature,
    setNewCaseFeature,
    newCaseSubmenu,
    setNewCaseSubmenu,
    newCasePriority,
    setNewCasePriority,
    newCaseStatus,
    setNewCaseStatus,
    newCaseDesc,
    setNewCaseDesc,
    newCaseAcceptance,
    setNewCaseAcceptance,
    editingTitle,
    setEditingTitle,
    editingSubmenu,
    setEditingSubmenu,
    editingPriority,
    setEditingPriority,
    editingModule,
    setEditingModule,
    moduleItems,
    setModuleItems,
    submenuItems,
    setSubmenuItems,
    priorityItems,
    setPriorityItems,
    suites,
    setSuites,
    suiteLoading,
    setSuiteLoading,
    suiteSaving,
    setSuiteSaving,
    suiteDialogOpen,
    setSuiteDialogOpen,
    suitePreSteps,
    setSuitePreSteps,
    suitePreStepDraft,
    setSuitePreStepDraft,
    suiteDescDraft,
    setSuiteDescDraft,
    suiteNameDraft,
    setSuiteNameDraft,
    suiteActorsDraft,
    setSuiteActorsDraft,
    suiteDefaultActorDraft,
    setSuiteDefaultActorDraft,
    selectedSuiteId,
    setSelectedSuiteId,
    newSuiteName,
    setNewSuiteName,
    newSuiteDesc,
    setNewSuiteDesc,
    suiteGenerating,
    setSuiteGenerating,
    suiteDeleting,
    selectedCase,
    filteredCases,
    totalPages,
    safePage,
    currentSteps,
    moduleLabelMap,
    dialogPlatform,
    isDialogApiPlatform,
    statusItems,
    handleStepDialogOpenChange,
    handleStepDialogSubmit,
    handleEnvDialogConfirm,
    handleDocAiConfirm,
    handlePlatformChange,
    handleUploadCsvFile,
    handleUploadDocFile,
    refreshCases,
    fetchActionCatalog,
    updateCaseMeta,
    loadCaseSteps,
    loadPlatforms,
    loadSuites,
    handleCreateSuite,
    handleAssignSuite,
    handleSaveSuitePreSteps,
    handleDeleteSuite,
    handleGenerateSuiteCode,
    handleAddSuitePreStep,
    handleEditSuitePreStep,
    handleAddStep,
    handleMockSaveCase,
    handleDeleteStep,
    handleDeleteSelected,
    handleExportCases,
    handleCreateCase,
    handleDeleteCase,
    handleEditStepInDialog,
    handleMoveStep,
    getStepParamHint,
    handleSaveSteps,
    openEnvTemplateDialogForCase,
    handleGenerateCode,
    generateCodeForCase,
    handleRunCase,
    handleRunSelected,
    runQueue,
    logPanelOpen,
    setLogPanelOpen,
    runningCaseId,
    runLogs: socketLogs,
    runConnected: socketConnected,
    clearLogs,
    runEnvTemplates,
    runEnvSelectedId,
    setRunEnvSelectedId,
    handleSelectRunEnv,
    apiPrefix,
    router,
  };
}

export type { RunTask };
export { STATUS_LABEL, PRIORITY_LABEL, SUBMENU_LABEL };
