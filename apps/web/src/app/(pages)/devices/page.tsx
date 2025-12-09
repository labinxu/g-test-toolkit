'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play,
  Square,
  Search,
  Trash2,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  Aperture,
  PackagePlus,
  Loader2,
  FilePlus,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error';
import { toast } from 'sonner';
import {
  DevicesTable,
  type DevicesTableColumn,
  type DevicesTableRow,
} from './components/devices-table';

const defaultHeaders = { Accept: 'application/json' };
const jsonHeaders = { ...defaultHeaders, 'Content-Type': 'application/json' };

const normalizeAvdKey = (value: string | null | undefined) =>
  value?.replace(/[\s_-]/g, '').toLowerCase() ?? '';

const avdKeysMatch = (
  source: string | null | undefined,
  target: string | null | undefined,
) => {
  const sourceKey = normalizeAvdKey(source);
  const targetKey = normalizeAvdKey(target);
  if (!sourceKey || !targetKey) return false;
  return (
    sourceKey === targetKey ||
    sourceKey.includes(targetKey) ||
    targetKey.includes(sourceKey)
  );
};

type AndroidEmulatorResponse = {
  avds: string[];
  running: {
    serial: string;
    avd: string | null;
    deviceName: string | null;
  } | null;
};

type AndroidStopResponse = {
  result: string;
  stopped: boolean;
  serial?: string;
  avd?: string | null;
  deviceName?: string | null;
  message?: string;
};

type AndroidStartResponse = {
  result: string;
  started?: boolean;
  serial: string;
  avd: string | null;
  deviceName?: string | null;
  message?: string;
  randomizedDeviceId?: string | null;
  deviceId?: string | null;
};

type AndroidDeleteResponse = {
  result: string;
  deleted: boolean;
  avd: string;
  message?: string;
};

type AndroidCreatableTemplate = {
  id: string;
  label: string;
  description?: string;
  defaultName: string;
};

type AndroidCreatableResponse = {
  templates: AndroidCreatableTemplate[];
};

type AndroidCreateResponse = {
  result: string;
  created: boolean;
  avd: string;
  templateId: string;
  message?: string;
};

type IosSimulator = {
  name: string;
  udid: string;
  runtime: string;
  state: string;
  isAvailable: boolean;
  platformVersion?: string;
  capabilities?: Record<string, any>;
};

type IosListResponse = {
  result: string;
  devices: IosSimulator[];
};

type IosActionResponse = {
  result: string;
  started?: boolean;
  stopped?: boolean;
  simulator: IosSimulator | null;
  message?: string;
};

type AndroidDeviceInfo = {
  serial: string;
  state: string;
  product?: string;
  model?: string;
  device?: string;
  transportId?: string;
  usb?: string;
};

type AndroidDevicesResponse = {
  devices?: string;
  list?: AndroidDeviceInfo[];
};

type FileNode = {
  name: string;
  path: string;
  isDirectory: boolean;
  createdAt?: string | null;
  children?: FileNode[];
};

async function getCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { token?: string };
    return data?.token ?? null;
  } catch (error) {
    console.error('Failed to fetch CSRF token', error);
    return null;
  }
}

const flattenFileNodes = (nodes: FileNode[] = []): FileNode[] => {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      if (node.children?.length) {
        result.push(...flattenFileNodes(node.children));
      }
    } else {
      result.push(node);
    }
  }
  return result;
};

export default function Page() {
  const [actionAvd, setActionAvd] = useState<string | null>(null);
  const [iosActionUdid, setIosActionUdid] = useState<string | null>(null);
  const [pendingStopAvd, setPendingStopAvd] = useState<string | null>(null);
  const [deletingAvd, setDeletingAvd] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customAvdName, setCustomAvdName] = useState<string>('');
  const [resetSelections, setResetSelections] = useState<
    Record<string, boolean>
  >({});
  const [deviceIds, setDeviceIds] = useState<Record<string, string>>({});
  const [androidHeadless, setAndroidHeadless] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const v = localStorage.getItem('gtt:androidSimulators:headless');
      return v === '1' || v === 'true';
    } catch {}
    return false;
  });
  // Android Simulators auto-refresh controls
  const [androidSimsAutoRefresh, setAndroidSimsAutoRefresh] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      try {
        const v = localStorage.getItem('gtt:androidSimulators:autoRefresh');
        return v == null ? true : v === '1' || v === 'true';
      } catch {}
      return true;
    },
  );
  const [androidSimsRefreshSec, setAndroidSimsRefreshSec] = useState<number>(
    () => {
      if (typeof window === 'undefined') return 3;
      try {
        const v = parseInt(
          localStorage.getItem('gtt:androidSimulators:refreshSec') || '3',
          10,
        );
        return Number.isFinite(v) && v >= 1 ? v : 3;
      } catch {}
      return 3;
    },
  );
  // Android Devices auto-refresh controls
  // Section collapse states
  const [androidSimulatorsCollapsed, setAndroidSimulatorsCollapsed] =
    useState<boolean>(() => {
      if (typeof window === 'undefined') return false;
      try {
        const v = localStorage.getItem(
          'gtt:section:androidSimulatorsCollapsed',
        );
        return v === '1' || v === 'true';
      } catch {}
      return false;
    });
  const [iosSimulatorsCollapsed, setIosSimulatorsCollapsed] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return false;
      try {
        const v = localStorage.getItem('gtt:section:iosSimulatorsCollapsed');
        return v === '1' || v === 'true';
      } catch {}
      return false;
    },
  );
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [installTarget, setInstallTarget] = useState<{
    serial: string;
    label: string;
  } | null>(null);
  const [selectedAppPath, setSelectedAppPath] = useState<string>('');
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [envTarget, setEnvTarget] = useState<AndroidDeviceInfo | null>(null);
  const [envKey, setEnvKey] = useState('');
  const [envName, setEnvName] = useState('');
  const [envDescription, setEnvDescription] = useState('');
  const [envConfigText, setEnvConfigText] = useState('');

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'gtt:androidSimulators:headless',
        androidHeadless ? '1' : '0',
      );
    } catch {}
  }, [androidHeadless]);
  useEffect(() => {
    try {
      localStorage.setItem(
        'gtt:androidSimulators:autoRefresh',
        androidSimsAutoRefresh ? '1' : '0',
      );
    } catch {}
  }, [androidSimsAutoRefresh]);
  useEffect(() => {
    try {
      localStorage.setItem(
        'gtt:androidSimulators:refreshSec',
        String(androidSimsRefreshSec | 0),
      );
    } catch {}
  }, [androidSimsRefreshSec]);
  useEffect(() => {
    try {
      localStorage.setItem(
        'gtt:section:androidSimulatorsCollapsed',
        androidSimulatorsCollapsed ? '1' : '0',
      );
    } catch {}
  }, [androidSimulatorsCollapsed]);
  useEffect(() => {
    try {
      localStorage.setItem(
        'gtt:section:iosSimulatorsCollapsed',
        iosSimulatorsCollapsed ? '1' : '0',
      );
    } catch {}
  }, [iosSimulatorsCollapsed]);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Appium server status
  type AppiumStatus = { running: boolean; port?: number };
  const appiumStatusQuery = useQuery<AppiumStatus>({
    queryKey: ['appium-status'],
    queryFn: async () => {
      const res = await fetch('/api/android/appium/status', {
        method: 'GET',
        headers: defaultHeaders,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to fetch appium status');
      }
      return res.json();
    },
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  const startAppiumMutation = useMutation<
    { result: string; started?: boolean; port?: number },
    Error,
    { port?: number }
  >({
    mutationFn: async ({ port }) => {
      const res = await fetch('/api/android/appium/start', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ port }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to start appium');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        data?.port
          ? `Appium server started on ${data.port}`
          : 'Appium server started',
      );
      queryClient.invalidateQueries({ queryKey: ['appium-status'] });
    },
    onError: (err: any) =>
      toast.error(err?.message || 'Failed to start appium'),
  });

  const stopAppiumMutation = useMutation<
    { result: string; stopped?: boolean },
    Error,
    void
  >({
    mutationFn: async () => {
      const res = await fetch('/api/android/appium/stop', {
        method: 'POST',
        headers: defaultHeaders,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to stop appium');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        data?.stopped ? 'Appium server stopped' : 'Appium not running',
      );
      queryClient.invalidateQueries({ queryKey: ['appium-status'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to stop appium'),
  });

  const devicesQuery = useQuery<AndroidDevicesResponse>({
    queryKey: ['devices'],
    queryFn: () =>
      fetch(`/api/android/devices`, {
        method: 'GET',
        headers: defaultHeaders,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await normalizeResponseError(res);
          if (isUnauthorizedError(err)) {
            try {
              router.push('/signin');
            } catch {}
          }
          throw new Error(err.message || 'Failed to fetch devices');
        }
        return (await res.json()) as AndroidDevicesResponse;
      }),
    staleTime: 5000,
    refetchOnWindowFocus: false,
    // Always fetch at least once even if section is collapsed; auto-refresh still respects collapse state.
    enabled: true,
    refetchInterval:
      !androidSimulatorsCollapsed && androidSimsAutoRefresh
        ? Math.max(1000, (androidSimsRefreshSec || 1) * 1000)
        : false,
    refetchIntervalInBackground:
      !androidSimulatorsCollapsed && androidSimsAutoRefresh,
  });

  const androidDevicesMap = useMemo(() => {
    const map = new Map<string, AndroidDeviceInfo>();
    (devicesQuery.data?.list || []).forEach((d) => {
      if (d?.serial) {
        map.set(d.serial, d);
      }
    });
    return map;
  }, [devicesQuery.data?.list]);

  const emulatorQuery = useQuery<AndroidEmulatorResponse>({
    queryKey: ['android-emulators'],
    queryFn: async () => {
      const res = await fetch('/api/android/emulators', {
        method: 'GET',
        headers: defaultHeaders,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to fetch emulators');
      }
      const data = await res.json();
      return data;
    },
    enabled: !androidSimulatorsCollapsed,
    refetchInterval:
      !androidSimulatorsCollapsed && androidSimsAutoRefresh
        ? Math.max(1000, (androidSimsRefreshSec || 1) * 1000)
        : false,
    refetchIntervalInBackground:
      !androidSimulatorsCollapsed && androidSimsAutoRefresh,
  });

  const creatableTemplatesQuery = useQuery<AndroidCreatableResponse>({
    queryKey: ['android-emulators-creatable'],
    queryFn: async () => {
      const res = await fetch('/api/android/emulators/creatable', {
        method: 'GET',
        headers: defaultHeaders,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to load templates');
      }
      return res.json();
    },
    enabled: createDialogOpen,
    staleTime: 60_000,
  });

  const runningInfo = emulatorQuery.data?.running ?? null;
  const runningAvd = runningInfo?.avd ?? null;
  const runningSerial = runningInfo?.serial ?? null;
  const runningDeviceName = runningInfo?.deviceName ?? null;

  const startMutation = useMutation<
    AndroidStartResponse,
    Error,
    { avd: string; headless: boolean; reset?: boolean }
  >({
    mutationFn: async ({ avd, headless, reset }) => {
      const res = await fetch('/api/android/emulators/start', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          avd,
          headless,
          reset,
          randomizeDeviceId: reset,
        }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to start emulator');
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      const baseMessage =
        data?.message ??
        (data?.avd ? `Emulator ${data.avd} started` : 'Emulator started');
      const deviceIdValue = data?.deviceId || data?.randomizedDeviceId || null;
      const suffix = deviceIdValue ? ` (Device ID: ${deviceIdValue})` : '';
      toast.success(`${baseMessage}${suffix}`);
      const avdKey = normalizeAvdKey(variables?.avd ?? data?.avd ?? '');
      if (avdKey) {
        const nextDeviceId = deviceIdValue || data?.serial || '';
        if (nextDeviceId) {
          setDeviceIds((current) => ({ ...current, [avdKey]: nextDeviceId }));
        }
      }
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to start emulator');
    },
    onSettled: () => {
      setActionAvd(null);
    },
  });
  const stopMutation = useMutation<AndroidStopResponse, Error, void>({
    mutationFn: async () => {
      const res = await fetch('/api/android/emulators/stop', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ serial: runningSerial }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to stop emulator');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? 'Emulator stopped');
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to stop emulator');
      setPendingStopAvd(null);
      setActionAvd(null);
    },
  });

  const deleteMutation = useMutation<
    AndroidDeleteResponse,
    Error,
    { avd: string }
  >({
    mutationFn: async ({ avd }) => {
      const res = await fetch(
        `/api/android/emulators/${encodeURIComponent(avd)}`,
        {
          method: 'DELETE',
          headers: defaultHeaders,
        },
      );
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to delete emulator');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? `Deleted emulator ${data.avd}`);
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to delete emulator');
    },
    onSettled: () => {
      setDeletingAvd(null);
    },
  });

  const createMutation = useMutation<
    AndroidCreateResponse,
    Error,
    { templateId: string; name?: string }
  >({
    mutationFn: async ({ templateId, name }) => {
      const res = await fetch('/api/android/emulators/create', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ templateId, name }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || 'Failed to create emulator');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? `Created emulator ${data.avd}`);
      queryClient.invalidateQueries({ queryKey: ['android-emulators'] });
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to create emulator');
    },
  });

  useEffect(() => {
    if (!pendingStopAvd) return;
    const stillRunning = avdKeysMatch(pendingStopAvd, runningAvd);
    if (!stillRunning) {
      setPendingStopAvd(null);
      setActionAvd((current) =>
        avdKeysMatch(current, pendingStopAvd) ? null : current,
      );
    }
  }, [pendingStopAvd, runningAvd]);

  useEffect(() => {
    if (!createDialogOpen) return;
    const templates = creatableTemplatesQuery.data?.templates ?? [];
    if (templates.length === 0) return;
    if (
      !selectedTemplateId ||
      !templates.some((tpl) => tpl.id === selectedTemplateId)
    ) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [
    createDialogOpen,
    creatableTemplatesQuery.data?.templates,
    selectedTemplateId,
  ]);

  const handleStart = useCallback(
    (avd: string) => {
      setActionAvd(avd);
      const avdKey = normalizeAvdKey(avd);
      const shouldReset = !!resetSelections[avdKey];
      startMutation.mutate({
        avd,
        headless: androidHeadless,
        reset: shouldReset,
      });
    },
    [startMutation, androidHeadless, resetSelections],
  );

  const handleStop = useCallback(
    (avd: string) => {
      if (!runningSerial) {
        toast.error('No running emulator detected');
        return;
      }
      setActionAvd(avd);
      setPendingStopAvd(avd);
      stopMutation.mutate();
    },
    [runningSerial, stopMutation],
  );

  const handleCreateDialogOpenChange = useCallback(
    (open: boolean) => {
      setCreateDialogOpen(open);
      if (!open) {
        setSelectedTemplateId('');
        setCustomAvdName('');
        createMutation.reset();
      }
    },
    [createMutation],
  );

  const handleDelete = useCallback(
    (avd: string) => {
      if (avdKeysMatch(avd, runningAvd)) {
        toast.error('Stop the emulator before deleting it');
        return;
      }
      setDeletingAvd(avd);
      deleteMutation.mutate({ avd });
    },
    [deleteMutation, runningAvd],
  );

  const handleResetToggle = useCallback((avd: string, checked: boolean) => {
    const key = normalizeAvdKey(avd);
    setResetSelections((current) => ({ ...current, [key]: checked }));
  }, []);

  const handleCreateEmulator = useCallback(() => {
    if (!selectedTemplateId) {
      toast.error('Please choose a template');
      return;
    }
    createMutation.mutate({
      templateId: selectedTemplateId,
      name: customAvdName.trim() || undefined,
    });
  }, [createMutation, selectedTemplateId, customAvdName]);

  const selectedTemplate = useMemo(() => {
    return (
      (creatableTemplatesQuery.data?.templates ?? []).find(
        (template) => template.id === selectedTemplateId,
      ) ?? null
    );
  }, [creatableTemplatesQuery.data?.templates, selectedTemplateId]);
  const appFilesQuery = useQuery<FileNode[]>({
    queryKey: ['app-files'],
    queryFn: async () => {
      const res = await fetch('/api/testcase/listapps?depth=1', {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || 'Failed to fetch app files');
      }
      const data = (await res.json()) as FileNode[] | { data?: FileNode[] };
      if (Array.isArray(data)) return data;
      if (Array.isArray((data as { data?: FileNode[] }).data)) {
        return (data as { data: FileNode[] }).data;
      }
      return [];
    },
    enabled: installDialogOpen,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const appFiles = useMemo(
    () =>
      flattenFileNodes(
        Array.isArray(appFilesQuery.data) ? appFilesQuery.data : [],
      ),
    [appFilesQuery.data],
  );

  useEffect(() => {
    if (!installDialogOpen) return;
    if (selectedAppPath || appFiles.length === 0) return;
    setSelectedAppPath(appFiles[0].path);
  }, [installDialogOpen, selectedAppPath, appFiles]);

  type InstallAppRequest = { filePath: string; serial: string };
  type InstallAppResponse = {
    result: string;
    installed?: number;
    serials?: string[];
    message?: string;
  };

  const closeInstallDialog = useCallback(() => {
    setInstallDialogOpen(false);
    setInstallTarget(null);
    setSelectedAppPath('');
  }, []);

  const installMutation = useMutation<
    InstallAppResponse,
    Error,
    InstallAppRequest
  >({
    mutationFn: async ({ filePath, serial }) => {
      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/testcase/apps/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ filePath, serials: [serial] }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
          throw new Error('Unauthorized');
        }
        throw new Error(err.message || 'Failed to install app');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? 'Install request submitted');
      closeInstallDialog();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to install app');
    },
  });

  const handleOpenInstallDialog = useCallback(
    (serial: string, label: string) => {
      if (!serial) {
        toast.error('未找到设备序列号，无法安装应用');
        return;
      }
      setInstallTarget({ serial, label });
      setInstallDialogOpen(true);
      appFilesQuery.refetch().catch(() => {});
    },
    [appFilesQuery],
  );

  const handleConfirmInstall = useCallback(() => {
    if (!installTarget) return;
    if (!selectedAppPath) {
      toast.error('请选择一个 app 文件');
      return;
    }
    installMutation.mutate({
      filePath: selectedAppPath,
      serial: installTarget.serial,
    });
  }, [installMutation, installTarget, selectedAppPath]);

  const installColumns: DevicesTableColumn[] = useMemo(
    () => [{ title: '选择', className: 'w-16' }, { title: 'FileName' }],
    [],
  );

  const installRows: DevicesTableRow[] = useMemo(() => {
    return appFiles.map((file) => ({
      key: file.path,
      className: cn(
        'hover:bg-muted/60',
        selectedAppPath === file.path && 'bg-primary/5',
      ),
      onClick: () => setSelectedAppPath(file.path),
      cells: [
        <input
          key="radio"
          type="radio"
          name="install-app"
          className="h-4 w-4 cursor-pointer"
          checked={selectedAppPath === file.path}
          onChange={() => setSelectedAppPath(file.path)}
        />,
        <span key="name" className="truncate">
          {file.name}
        </span>,
      ],
    }));
  }, [appFiles, selectedAppPath]);

  const suggestKey = (serial: string, info?: AndroidDeviceInfo | null) => {
    const base = info?.model || info?.device || info?.product || 'android';
    return `${base}-${serial}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-');
  };

  const buildDefaultConfig = (
    serial: string,
    info?: AndroidDeviceInfo | null,
  ) => {
    const deviceName = info?.model || info?.device || info?.product || serial;
    return {
      deviceName,
      udid: serial,
      platformName: 'Android',
      automationName: 'UiAutomator2',
      appPackage: 'com.gettr.gettr',
      appActivity: '.MainActivity',
    };
  };

  const openEnvTemplateDialog = useCallback(
    (serial: string) => {
      const info = androidDevicesMap.get(serial) || null;
      const key = suggestKey(serial, info);
      const name = `${info?.model || info?.device || info?.product || 'Android Device'} (${serial})`;
      const config = buildDefaultConfig(serial, info);
      setEnvTarget(info || { serial, state: 'device' });
      setEnvKey(key);
      setEnvName(name);
      setEnvDescription('');
      setEnvConfigText(JSON.stringify(config, null, 2));
      setEnvDialogOpen(true);
    },
    [androidDevicesMap],
  );

  const closeEnvDialog = useCallback(() => {
    setEnvDialogOpen(false);
    setEnvTarget(null);
    setEnvKey('');
    setEnvName('');
    setEnvDescription('');
    setEnvConfigText('');
  }, []);

  const createEnvTemplateMutation = useMutation<
    { id: number; key: string; name: string },
    Error,
    void
  >({
    mutationFn: async () => {
      if (!envKey.trim() || !envName.trim()) {
        throw new Error('Key 和 Name 不能为空');
      }
      let parsed: any = {};
      try {
        parsed = envConfigText.trim() ? JSON.parse(envConfigText) : {};
      } catch (err) {
        throw new Error('配置 JSON 解析失败，请检查格式');
      }
      const res = await fetch('/api/env-templates', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          platform: 'gettr-android',
          driver: 'android',
          key: envKey.trim(),
          name: envName.trim(),
          description: envDescription || undefined,
          config: parsed,
          enabled: true,
        }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        if (isUnauthorizedError(err)) {
          try {
            router.push('/signin');
          } catch {}
        }
        throw new Error(err.message || '创建环境模板失败');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`已创建环境模板 ${data?.name || envName}`);
      closeEnvDialog();
    },
    onError: (error) => {
      toast.error(error?.message || '创建环境模板失败');
    },
  });

  const emulatorRows = useMemo(() => {
    return (emulatorQuery.data?.avds ?? []).map((avd) => {
      const isRunning = avdKeysMatch(avd, runningAvd);
      const deviceName = isRunning ? (runningDeviceName ?? avd) : null;
      return { avd, isRunning, deviceName };
    });
  }, [emulatorQuery.data?.avds, runningAvd, runningDeviceName]);

  const isStarting = startMutation.isPending;
  const isStopping = stopMutation.isPending || !!pendingStopAvd;
  const isCreating = createMutation.isPending;

  const androidColumns: DevicesTableColumn[] = [
    { title: 'Name', className: 'w-[240px]' },
    { title: 'UDID', className: 'w-[220px]' },
    { title: 'Device ID', className: 'w-[200px]' },
    { title: 'Reset', className: 'w-[160px] text-center' },
    { title: 'Status', className: 'w-[160px]' },
    { title: 'Actions', className: 'w-[140px] text-right' },
  ];

  const androidRows: DevicesTableRow[] = useMemo(() => {
    const rows: DevicesTableRow[] = [];
    const listDevices = devicesQuery.data?.list || [];
    const physicalDevices = listDevices.filter(
      (dev) => !`${dev?.serial || ''}`.toLowerCase().startsWith('emulator-'),
    );

    // Physical / USB devices
    for (const dev of physicalDevices) {
      if (!dev?.serial) continue;
      const serial = dev.serial;
      const name = dev.model || dev.product || dev.device || serial;
      const status = dev.state || 'unknown';
      const isInstallingHere =
        installMutation.isPending && installTarget?.serial === serial;
      const isCreatingEnv =
        createEnvTemplateMutation.isPending && envTarget?.serial === serial;
      rows.push({
        key: `dev-${serial}`,
        cells: [
          <span className="truncate" key="name">
            {name}
          </span>,
          <span className="truncate" key="serial">
            {serial}
          </span>,
          <span className="truncate" key="id">
            {dev.product || dev.usb || '-'}
          </span>,
          <span className="text-muted-foreground" key="reset">
            -
          </span>,
          <span className="capitalize" key="status">
            {status}
          </span>,
          <div className="flex justify-end gap-1" key="actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  disabled={installMutation.isPending}
                  onClick={() => handleOpenInstallDialog(serial, serial)}
                  aria-label={`Install app on ${serial}`}
                >
                  {isInstallingHere ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PackagePlus className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Install</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  disabled={createEnvTemplateMutation.isPending}
                  onClick={() => openEnvTemplateDialog(serial)}
                  aria-label={`Create env template for ${serial}`}
                >
                  {isCreatingEnv ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FilePlus className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Env template</TooltipContent>
            </Tooltip>
          </div>,
        ],
      });
    }

    // Emulator rows (always)
    for (const { avd, isRunning, deviceName } of emulatorRows) {
      const isActionTarget = actionAvd === avd || deletingAvd === avd;
      const avdKey = normalizeAvdKey(avd);
      const resetChecked = !!resetSelections[avdKey];
      const statusLabel = isActionTarget
        ? isStarting
          ? 'Starting...'
          : isStopping
            ? 'Stopping...'
            : isRunning
              ? 'Running'
              : 'Stopped'
        : isRunning
          ? 'Running'
          : 'Stopped';
      const startLabel = isActionTarget && isStarting ? 'Starting...' : 'Start';
      const stopLabel = isActionTarget && isStopping ? 'Stopping...' : 'Stop';
      const isDeletingCurrent = deleteMutation.isPending && deletingAvd === avd;
      const deleteLabel = isDeletingCurrent ? 'Deleting...' : 'Delete';
      const installSerial = isRunning
        ? (runningSerial || deviceIds[avdKey] || '')
        : '';
      const isInstallingHere =
        installMutation.isPending && installTarget?.serial === installSerial;
      const installLabel = deviceName ? `${deviceName} (${avd})` : avd;
      const isCreatingEnv =
        createEnvTemplateMutation.isPending &&
        !!installSerial &&
        envTarget?.serial === installSerial;
      rows.push({
        key: `emu-${avd}`,
        cells: [
          <span className="truncate" key="name">
            {avd}
          </span>,
          <span className="truncate" key="udid">
            {isRunning ? (deviceName ?? 'Booted') : '-'}
          </span>,
          <span className="truncate" key="id">
            {deviceIds[avdKey] ?? '-'}
          </span>,
          <div className="flex justify-center" key="reset">
            <Checkbox
              checked={resetChecked}
              onCheckedChange={(checked) =>
                handleResetToggle(avd, checked === true)
              }
              aria-label={`Reset emulator ${avd} before starting`}
            />
          </div>,
          <span key="status">{statusLabel}</span>,
          <div className="flex justify-end gap-1" key="actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className={cn(
                    'h-8 w-8 rounded-full',
                    !isRunning || !installSerial || installMutation.isPending
                      ? 'text-muted-foreground'
                      : 'text-green-600',
                  )}
                  disabled={
                    !isRunning || !installSerial || installMutation.isPending
                  }
                  onClick={() =>
                    handleOpenInstallDialog(installSerial || '', installLabel)
                  }
                  aria-label={`Install app on ${avd}`}
                >
                  {isInstallingHere ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PackagePlus className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Install</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className={cn(
                    'h-8 w-8 rounded-full',
                    !installSerial || createEnvTemplateMutation.isPending
                      ? 'text-muted-foreground'
                      : 'text-green-600',
                  )}
                  disabled={!installSerial || createEnvTemplateMutation.isPending}
                  onClick={() => installSerial && openEnvTemplateDialog(installSerial)}
                  aria-label={`Create env template for ${avd}`}
                >
                  {isCreatingEnv ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FilePlus className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Env template</TooltipContent>
            </Tooltip>
            {isRunning ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={isStopping || isDeletingCurrent}
                    onClick={() => handleStop(avd)}
                    aria-label={`Stop emulator ${avd}`}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>{stopLabel}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="default"
                    className="h-8 w-8 rounded-full"
                    disabled={isStarting || isDeletingCurrent}
                    onClick={() => handleStart(avd)}
                    aria-label={`Start emulator ${avd}`}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>{startLabel}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  disabled={!isRunning}
                  onClick={() => {
                    const dId =
                      deviceIds[avdKey] ||
                      (avdKeysMatch(avd, runningAvd) ? (runningSerial ?? '') : '');
                    const params = new URLSearchParams();
                    if (dId) params.set('deviceId', dId);
                    if (avd) params.set('avd', avd);
                    router.push(
                      `/tools/android-inspector${
                        params.toString() ? `?${params}` : ''
                      }`,
                    );
                  }}
                  aria-label={`Inspect emulator ${avd}`}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Inspect</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  disabled={
                    isRunning || isDeletingCurrent || isStarting || isStopping
                  }
                  onClick={() => handleDelete(avd)}
                  aria-label={`Delete emulator ${avd}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>{deleteLabel}</TooltipContent>
            </Tooltip>
          </div>,
        ],
      });
    }
    return rows;
  }, [
    devicesQuery.data?.list,
    emulatorRows,
    actionAvd,
    deletingAvd,
    resetSelections,
    isStarting,
    isStopping,
    deleteMutation.isPending,
    installMutation.isPending,
    installTarget?.serial,
    envTarget?.serial,
    createEnvTemplateMutation.isPending,
    deviceIds,
    runningAvd,
    runningSerial,
    handleResetToggle,
    handleStart,
    handleStop,
    handleDelete,
    handleOpenInstallDialog,
    openEnvTemplateDialog,
    router,
  ]);
  useEffect(() => {
    const keys = new Set(
      (emulatorQuery.data?.avds ?? []).map((avd) => normalizeAvdKey(avd)),
    );
    setResetSelections((current) => {
      const filteredEntries = Object.entries(current).filter(([key]) =>
        keys.has(key),
      );
      if (filteredEntries.length === Object.keys(current).length) {
        return current;
      }
      const next: Record<string, boolean> = {};
      for (const [key, value] of filteredEntries) {
        next[key] = value;
      }
      return next;
    });
    setDeviceIds((current) => {
      const filteredEntries = Object.entries(current).filter(([key]) =>
        keys.has(key),
      );
      if (filteredEntries.length === Object.keys(current).length) {
        return current;
      }
      const next: Record<string, string> = {};
      for (const [key, value] of filteredEntries) {
        next[key] = value;
      }
      return next;
    });
  }, [emulatorQuery.data?.avds]);

  const iosQuery = useQuery<IosListResponse>({
    queryKey: ['ios-simulators'],
    queryFn: async () => {
      const res = await fetch('/api/ios/devices?availableOnly=false', {
        method: 'GET',
        headers: defaultHeaders,
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        throw new Error(err.message || 'Failed to fetch iOS simulators');
      }
      return res.json();
    },
    enabled: !iosSimulatorsCollapsed,
  });

  const iosStartMutation = useMutation<
    IosActionResponse,
    Error,
    { udid: string }
  >({
    mutationFn: async ({ udid }) => {
      const res = await fetch('/api/ios/simulators/start', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ udid }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        throw new Error(err.message || 'Failed to start iOS simulator');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        data?.message ?? `Simulator ${data?.simulator?.name ?? ''} started`,
      );
      queryClient.invalidateQueries({ queryKey: ['ios-simulators'] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to start iOS simulator');
    },
    onSettled: () => {
      setIosActionUdid(null);
    },
  });

  const iosStopMutation = useMutation<
    IosActionResponse,
    Error,
    { udid: string }
  >({
    mutationFn: async ({ udid }) => {
      const res = await fetch('/api/ios/simulators/stop', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ udid }),
      });
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        throw new Error(err.message || 'Failed to stop iOS simulator');
      }
      return res.json();
    },
    onSuccess: (data) => {
      const label = data?.simulator?.name ?? '';
      toast.success(
        data?.message ??
          (label ? `Simulator ${label} stopped` : 'Simulator stopped'),
      );
      queryClient.invalidateQueries({ queryKey: ['ios-simulators'] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Failed to stop iOS simulator');
    },
    onSettled: () => {
      setIosActionUdid(null);
    },
  });

  const handleIosStart = useCallback(
    (udid: string) => {
      setIosActionUdid(udid);
      iosStartMutation.mutate({ udid });
    },
    [iosStartMutation],
  );

  const handleIosStop = useCallback(
    (udid: string) => {
      setIosActionUdid(udid);
      iosStopMutation.mutate({ udid });
    },
    [iosStopMutation],
  );

  const iosIsStarting = iosStartMutation.isPending;
  const iosIsStopping = iosStopMutation.isPending;

  const iosColumns: DevicesTableColumn[] = [
    { title: 'Name', className: 'w-[240px]' },
    { title: 'Runtime', className: 'w-[220px]' },
    { title: 'State', className: 'w-[160px]' },
    { title: 'Actions', className: 'w-[140px] text-right' },
  ];

  const iosRows: DevicesTableRow[] = useMemo(() => {
    return (iosQuery.data?.devices ?? []).map((device) => {
      const udid = device.udid;
      const isRunning = device.state === 'Booted';
      const isActionTarget = iosActionUdid === udid;
      const statusLabel = isActionTarget
        ? iosIsStarting
          ? 'Starting...'
          : iosIsStopping
            ? 'Stopping...'
            : device.state
        : device.state;
      const startLabel =
        isActionTarget && iosIsStarting ? 'Starting...' : 'Start';
      const stopLabel =
        isActionTarget && iosIsStopping ? 'Stopping...' : 'Stop';

      return {
        key: udid,
        cells: [
          <span className="truncate" key="name">
            {device.name}
          </span>,
          <span className="truncate" key="runtime">
            {device.runtime}
          </span>,
          <span key="state">{statusLabel}</span>,
          <div className="flex justify-end gap-1" key="actions">
            {isRunning ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    disabled={iosIsStopping}
                    onClick={() => handleIosStop(udid)}
                    aria-label={`Stop iOS simulator ${device.name}`}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>{stopLabel}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="default"
                    className="h-8 w-8 rounded-full"
                    disabled={iosIsStarting}
                    onClick={() => handleIosStart(udid)}
                    aria-label={`Start iOS simulator ${device.name}`}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>{startLabel}</TooltipContent>
              </Tooltip>
            )}
          </div>,
        ],
      };
    });
  }, [
    iosQuery.data?.devices,
    iosActionUdid,
    iosIsStarting,
    iosIsStopping,
    handleIosStart,
    handleIosStop,
  ]);

  return (
    <TooltipProvider>
      <div className="flex flex-1 flex-col gap-2 overflow-auto rounded-lg border-2 p-4 shadow-lg">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">Android Simulators</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setAndroidSimulatorsCollapsed((v) => !v)}
                  aria-label={
                    androidSimulatorsCollapsed
                      ? 'Expand Android Simulators'
                      : 'Collapse Android Simulators'
                  }
                >
                  {androidSimulatorsCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {androidSimulatorsCollapsed ? 'Expand' : 'Collapse'}
              </TooltipContent>
            </Tooltip>
          </div>
          {!androidSimulatorsCollapsed && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Switch
                    id="android-headless"
                    checked={androidHeadless}
                    onCheckedChange={(checked) => setAndroidHeadless(!!checked)}
                  />
                  <label
                    htmlFor="android-headless"
                    className="cursor-pointer select-none"
                  >
                    Headless mode
                  </label>
                </div>
                <div className="text-muted-foreground flex items-center gap-2">
                  <Switch
                    id="android-sims-auto-refresh"
                    checked={androidSimsAutoRefresh}
                    onCheckedChange={(checked) =>
                      setAndroidSimsAutoRefresh(!!checked)
                    }
                  />
                  <label
                    htmlFor="android-sims-auto-refresh"
                    className="cursor-pointer select-none"
                  >
                    Auto refresh
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="android-sims-refresh-sec"
                    className="text-muted-foreground"
                  >
                    Interval
                  </Label>
                  <Input
                    id="android-sims-refresh-sec"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    className="h-8 w-16"
                    value={androidSimsRefreshSec}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) {
                        const clamped = Math.min(
                          60,
                          Math.max(1, Math.floor(n)),
                        );
                        setAndroidSimsRefreshSec(clamped);
                      } else {
                        setAndroidSimsRefreshSec(3);
                      }
                    }}
                  />
                  <span className="text-muted-foreground">s</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => emulatorQuery.refetch().catch(() => {})}
                      aria-label="Refresh Android emulators"
                      disabled={emulatorQuery.isFetching}
                    >
                      <RefreshCcw
                        className={cn(
                          'h-4 w-4',
                          emulatorQuery.isFetching && 'animate-spin',
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>Refresh</TooltipContent>
                </Tooltip>
                <Dialog
                  open={createDialogOpen}
                  onOpenChange={handleCreateDialogOpenChange}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      Create
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Android Emulator</DialogTitle>
                      <DialogDescription>
                        Select a template to create a new Android emulator.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {creatableTemplatesQuery.isLoading ? (
                        <p className="text-muted-foreground text-sm">
                          Loading templates...
                        </p>
                      ) : creatableTemplatesQuery.isError ? (
                        <p className="text-destructive text-sm">
                          {creatableTemplatesQuery.error instanceof Error
                            ? creatableTemplatesQuery.error.message
                            : 'Failed to load templates.'}
                        </p>
                      ) : (creatableTemplatesQuery.data?.templates?.length ??
                          0) === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          No templates available.
                        </p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="android-emulator-template">
                              Template
                            </Label>
                            <Select
                              value={selectedTemplateId || undefined}
                              onValueChange={(value) =>
                                setSelectedTemplateId(value)
                              }
                            >
                              <SelectTrigger id="android-emulator-template">
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  creatableTemplatesQuery.data?.templates ?? []
                                ).map((template) => (
                                  <SelectItem
                                    key={template.id}
                                    value={template.id}
                                  >
                                    {template.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedTemplate?.description && (
                              <p className="text-muted-foreground text-xs">
                                {selectedTemplate.description}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="android-emulator-name">
                              Custom Name (optional)
                            </Label>
                            <Input
                              id="android-emulator-name"
                              value={customAvdName}
                              onChange={(event) =>
                                setCustomAvdName(event.target.value)
                              }
                              placeholder={
                                selectedTemplate?.defaultName ?? 'pixel-avd'
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isCreating}
                        >
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button
                        type="button"
                        onClick={handleCreateEmulator}
                        disabled={
                          isCreating ||
                          creatableTemplatesQuery.isLoading ||
                          !selectedTemplateId ||
                          (creatableTemplatesQuery.data?.templates?.length ??
                            0) === 0 ||
                          creatableTemplatesQuery.isError
                        }
                      >
                        {isCreating ? 'Creating...' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const running = !!appiumStatusQuery.data?.running;
                        if (running) {
                          stopAppiumMutation.mutate();
                        } else {
                          startAppiumMutation.mutate({});
                        }
                      }}
                      className={cn('h-8 w-8 rounded-full p-0')}
                      aria-label={
                        appiumStatusQuery.data?.running
                          ? 'Stop Appium Server'
                          : 'Start Appium Server'
                      }
                      disabled={
                        startAppiumMutation.isPending ||
                        stopAppiumMutation.isPending
                      }
                    >
                      <Aperture
                        className={cn(
                          'h-4 w-4',
                          appiumStatusQuery.data?.running
                            ? 'text-green-600'
                            : 'text-red-600',
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={6}>
                    {startAppiumMutation.isPending ||
                    stopAppiumMutation.isPending
                      ? 'Processing...'
                      : appiumStatusQuery.data?.running
                        ? 'Appium running. Click to stop'
                        : 'Start Appium Server'}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-2 rounded-lg border">
                <DevicesTable
                  columns={androidColumns}
                  rows={androidRows}
                  loading={emulatorQuery.isLoading || devicesQuery.isLoading}
                  loadingText="Loading Android devices..."
                  emptyText="No Android devices or simulators found."
                />
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">iOS Simulators</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setIosSimulatorsCollapsed((v) => !v)}
                  aria-label={
                    iosSimulatorsCollapsed
                      ? 'Expand iOS Simulators'
                      : 'Collapse iOS Simulators'
                  }
                >
                  {iosSimulatorsCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {iosSimulatorsCollapsed ? 'Expand' : 'Collapse'}
              </TooltipContent>
            </Tooltip>
          </div>
          {!iosSimulatorsCollapsed && (
            <div className="mt-2 rounded-lg border">
              <DevicesTable
                columns={iosColumns}
                rows={iosRows}
                loading={iosQuery.isLoading}
                loadingText="Loading iOS simulators..."
                emptyText="No iOS simulators found."
              />
            </div>
          )}
        </div>
        <Dialog
          open={installDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeInstallDialog();
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Install app</DialogTitle>
              <DialogDescription>
                选择要安装到{' '}
                <span className="font-medium">
                  {installTarget?.label ?? '当前设备'}
                </span>
                {installTarget?.serial ? ` (${installTarget.serial})` : ''} 的
                app 包。
              </DialogDescription>
            </DialogHeader>
            {appFilesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>正在加载应用列表...</span>
              </div>
            ) : appFilesQuery.isError ? (
              <div className="text-destructive text-sm">
                {appFilesQuery.error instanceof Error
                  ? appFilesQuery.error.message
                  : 'Failed to load app files.'}
              </div>
            ) : appFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                暂无可用的 app 包，请先在「资源 - App」页面上传文件。
              </div>
            ) : (
              <ScrollArea className="max-h-72 rounded-md border">
                <DevicesTable
                  columns={installColumns}
                  rows={installRows}
                  loading={false}
                  emptyText="暂无可用的 app 包"
                  loadingText="正在加载应用列表..."
                />
              </ScrollArea>
            )}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeInstallDialog}
                disabled={installMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmInstall}
                disabled={
                  !installTarget ||
                  !selectedAppPath ||
                  appFilesQuery.isLoading ||
                  appFiles.length === 0 ||
                  installMutation.isPending
                }
                className="w-[120px] justify-center"
              >
                {installMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  'Install'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={envDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeEnvDialog();
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>创建环境模板</DialogTitle>
              <DialogDescription>
                基于当前设备快速生成 env-template，用于测试用例运行时复用。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <div>Serial: {envTarget?.serial || '(未知)'}</div>
                <div className="text-muted-foreground">
                  {envTarget?.model || envTarget?.device || envTarget?.product
                    ? `Model: ${envTarget?.model || envTarget?.device || envTarget?.product}`
                    : 'Model: (无)'}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="env-key">Key</Label>
                  <Input
                    id="env-key"
                    value={envKey}
                    onChange={(e) => setEnvKey(e.target.value)}
                    placeholder="android-mydevice"
                  />
                  <p className="text-xs text-muted-foreground">
                    需唯一，用于引用模板。
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="env-name">Name</Label>
                  <Input
                    id="env-name"
                    value={envName}
                    onChange={(e) => setEnvName(e.target.value)}
                    placeholder="My Android Device"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="env-desc">Description</Label>
                <Input
                  id="env-desc"
                  value={envDescription}
                  onChange={(e) => setEnvDescription(e.target.value)}
                  placeholder="可选：描述用途或设备信息"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="env-config">配置 JSON</Label>
                  <span className="text-xs text-muted-foreground">
                    会直接写入模板的 android 配置
                  </span>
                </div>
                <Textarea
                  id="env-config"
                  value={envConfigText}
                  onChange={(e) => setEnvConfigText(e.target.value)}
                  className="min-h-[200px] font-mono text-xs"
                  spellCheck={false}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeEnvDialog}
                disabled={createEnvTemplateMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={() => createEnvTemplateMutation.mutate()}
                disabled={
                  createEnvTemplateMutation.isPending ||
                  !envKey.trim() ||
                  !envName.trim()
                }
              >
                {createEnvTemplateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  '创建'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
