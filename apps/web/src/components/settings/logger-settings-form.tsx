'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/app/context/session-context';
import { normalizeResponseError } from '@/lib/error';

type LoggerLevel = 'error' | 'warn' | 'tc' | 'info' | 'debug';

type LoggerFormState = {
  filePath: string;
  fileLevel: LoggerLevel;
  maxSizeMb: string;
  maxFiles: string;
  zippedArchive: boolean;
};

const LEVELS: LoggerLevel[] = ['error', 'warn', 'tc', 'info', 'debug'];

const DEFAULT_FORM: LoggerFormState = {
  filePath: './logs/app.log',
  fileLevel: 'error',
  maxSizeMb: '20',
  maxFiles: '30',
  zippedArchive: true,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeResponse = (data: any): LoggerFormState => {
  const filePath =
    typeof data?.filePath === 'string' && data.filePath.trim()
      ? data.filePath.trim()
      : DEFAULT_FORM.filePath;
  const level = LEVELS.includes(data?.fileLevel) ? data.fileLevel : DEFAULT_FORM.fileLevel;
  const maxSize = Number(data?.maxSizeMb);
  const maxFiles = Number(data?.maxFiles);
  return {
    filePath,
    fileLevel: level,
    maxSizeMb: Number.isFinite(maxSize)
      ? String(clamp(Math.floor(maxSize), 1, 1024))
      : DEFAULT_FORM.maxSizeMb,
    maxFiles: Number.isFinite(maxFiles)
      ? String(clamp(Math.floor(maxFiles), 1, 200))
      : DEFAULT_FORM.maxFiles,
    zippedArchive:
      data?.zippedArchive === undefined
        ? DEFAULT_FORM.zippedArchive
        : !!data.zippedArchive,
  };
};

const clampNumericField = (
  raw: string,
  fallbackRaw: string,
  defaultRaw: string,
  min: number,
  max: number,
): number => {
  const fallbackNum = Number(fallbackRaw);
  const fallback = Number.isFinite(fallbackNum)
    ? Math.floor(fallbackNum)
    : Math.floor(Number(defaultRaw));
  const candidate = Number(raw);
  const base = Number.isFinite(candidate) ? Math.floor(candidate) : fallback;
  return clamp(base, min, max);
};

export function LoggerSettingsForm() {
  const { isAuthenticated } = useSession();
  const [form, setForm] = useState<LoggerFormState>(DEFAULT_FORM);
  const [initial, setInitial] = useState<LoggerFormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/settings/logger', { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 403) {
          setAccessDenied(true);
          setInitial(null);
          setForm(DEFAULT_FORM);
          return;
        }
        if (!res.ok) {
          const err = await normalizeResponseError(res);
          throw new Error(err.message || 'Failed to load logger settings');
        }
        const data = await res.json();
        if (cancelled) return;
        const normalized = normalizeResponse(data);
        setAccessDenied(false);
        setInitial(normalized);
        setForm(normalized);
      } catch (e: any) {
        if (cancelled) return;
        const message = e?.message || 'Failed to load logger settings';
        setError(message);
        setInitial({ ...DEFAULT_FORM });
        setForm({ ...DEFAULT_FORM });
        toast.error(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      form.filePath !== initial.filePath ||
      form.fileLevel !== initial.fileLevel ||
      form.maxSizeMb !== initial.maxSizeMb ||
      form.maxFiles !== initial.maxFiles ||
      form.zippedArchive !== initial.zippedArchive
    );
  }, [form, initial]);

  const disabled = loading || saving || accessDenied;

  const handleSave = async () => {
    if (!isAuthenticated || accessDenied) return;
    setSaving(true);
    setError(null);
    try {
      const normalizedSize = clampNumericField(
        form.maxSizeMb,
        initial?.maxSizeMb ?? DEFAULT_FORM.maxSizeMb,
        DEFAULT_FORM.maxSizeMb,
        1,
        1024,
      );
      const normalizedFiles = clampNumericField(
        form.maxFiles,
        initial?.maxFiles ?? DEFAULT_FORM.maxFiles,
        DEFAULT_FORM.maxFiles,
        1,
        200,
      );
      const payload = {
        filePath:
          form.filePath.trim() ||
          initial?.filePath ||
          DEFAULT_FORM.filePath,
        fileLevel: form.fileLevel,
        maxSizeMb: normalizedSize,
        maxFiles: normalizedFiles,
        zippedArchive: form.zippedArchive,
      };
      const res = await fetch('/api/settings/logger', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 403) {
        setAccessDenied(true);
        throw new Error('Admin privileges are required to update logger settings');
      }
      if (!res.ok) {
        const err = await normalizeResponseError(res);
        throw new Error(err.message || 'Failed to save logger settings');
      }
      const data = await res.json();
      const normalized = normalizeResponse(data);
      setInitial(normalized);
      setForm(normalized);
      setAccessDenied(false);
      toast.success('Logger settings updated');
    } catch (e: any) {
      const message = e?.message || 'Failed to save logger settings';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (initial) {
      setForm(initial);
      return;
    }
    setForm(DEFAULT_FORM);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logger Settings</CardTitle>
        <CardDescription>
          Manage server-side file logger configuration. Only administrators can view or update these values.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && !accessDenied ? (
          <p className="text-sm text-muted-foreground">Loading current configuration…</p>
        ) : null}
        {accessDenied ? (
          <p className="text-sm text-muted-foreground">
            Admin privileges are required to manage logger settings.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Label
                htmlFor="logger-file-path"
                className="text-xs text-muted-foreground"
              >
                Log file path
              </Label>
              <Input
                id="logger-file-path"
                className="h-9 w-full max-w-md"
                value={form.filePath}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, filePath: e.target.value }))
                }
                placeholder="./logs/app.log"
                disabled={disabled}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="logger-file-level"
                  className="text-xs text-muted-foreground"
                >
                  File level
                </Label>
                <Select
                  value={form.fileLevel}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      fileLevel:
                        (value as LoggerLevel) ?? DEFAULT_FORM.fileLevel,
                    }))
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    id="logger-file-level"
                    className="h-9 w-40"
                  >
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="logger-max-size"
                  className="text-xs text-muted-foreground"
                >
                  Max size (MB)
                </Label>
                <Input
                  id="logger-max-size"
                  type="number"
                  min={1}
                  max={1024}
                  step={1}
                  className="h-9 w-28"
                  value={form.maxSizeMb}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, maxSizeMb: e.target.value }))
                  }
                  disabled={disabled}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="logger-max-files"
                  className="text-xs text-muted-foreground"
                >
                  Max files
                </Label>
                <Input
                  id="logger-max-files"
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  className="h-9 w-28"
                  value={form.maxFiles}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, maxFiles: e.target.value }))
                  }
                  disabled={disabled}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="logger-zipped"
                  className="text-xs text-muted-foreground"
                >
                  Zip archives
                </Label>
                <Switch
                  id="logger-zipped"
                  checked={form.zippedArchive}
                  onCheckedChange={(value) =>
                    setForm((prev) => ({ ...prev, zippedArchive: !!value }))
                  }
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        )}
        {error && !accessDenied ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t py-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={disabled || !isDirty}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={disabled || !isDirty}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}
