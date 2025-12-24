'use client';

import { useEffect, useState } from 'react';
import { UploadCloud, FileCode2, RefreshCw, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSession } from '@/app/context/session-context';

type GeneratedMethodInfo = {
  name: string;
  returnType: string;
  description: string;
  selectorType: string | null;
  selector: string | null;
  targetRoute: string | null;
  targetPageClass: string | null;
};

type GeneratedPageInfo = {
  dartPageClass: string;
  dartFile: string;
  tsClass: string;
  filePath: string;
   isEntry?: boolean;
  methods: GeneratedMethodInfo[];
};

type GenerateResult = {
  result?: string;
  branch?: string;
  sanitizedBranch?: string;
  outDir?: string;
  pages?: GeneratedPageInfo[];
  platform?: string | null;
  language?: string | null;
  error?: string;
};

type MetaFileInfo = {
  branch?: string | null;
  sanitizedBranch: string;
  filePath: string;
  platform?: string | null;
  language?: string | null;
};

type FlutterControlMeta = {
  id?: string;
  method?: string | null;
  handler?: string | null;
  label?: string | null;
  labelSource?: string | null;
  labelLocaleKey?: string | null;
  translations?: Record<string, string> | null;
  selectorType?: string | null;
  selector?: string | null;
  targetRoute?: string | null;
  targetPageClass?: string | null;
  description?: string | null;
  sourceFileLine?: number | null;
};

type FlutterPageMeta = {
  pageClass: string;
  pageFile: string;
  controls: FlutterControlMeta[];
  isEntry?: boolean;
  platform?: string | null;
};

type FlutterMeta = {
  branch?: string;
  sanitizedBranch?: string;
  generatedAt?: string;
  flutterRoot?: string;
  platform?: string | null;
  language?: string | null;
   availableLanguages?: string[];
  entryPageClass?: string | null;
  pages: FlutterPageMeta[];
};

async function extractErrorMessage(res: Response, fallback: string) {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = (await res.json()) as any;
      const msg = data?.message ?? data?.error;
      if (Array.isArray(msg)) return msg.join(', ');
      if (typeof msg === 'string' && msg.length > 0) return msg;
      return fallback;
    }
    const text = await res.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export default function FlutterPageObjectsToolPage() {
  const { isAuthenticated } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metaFiles, setMetaFiles] = useState<MetaFileInfo[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [uploadedMeta, setUploadedMeta] = useState<FlutterMeta | null>(null);
  const [sourceKind, setSourceKind] = useState<'upload' | 'branch' | null>(null);
  const [currentBranchSanitized, setCurrentBranchSanitized] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<{
    page: GeneratedPageInfo;
    raw?: FlutterPageMeta | null;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'android' | 'ios'>('android');
  const [language, setLanguage] = useState<string>('en');
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(['en']);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    setUploadedMeta(null);
    setSourceKind(null);
    setPreviewPage(null);
    setPreviewError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError('请先登录后再上传 Flutter 页面表格（JSON）');
      setResult(null);
      return;
    }
    if (!file) {
      setError('请选择第一步扫描生成的 JSON 表格文件');
      setResult(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('目前只支持上传 JSON 格式的表格文件（*.json）');
      setResult(null);
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    setUploadedMeta(null);
    setSourceKind(null);
    setPreviewPage(null);
    setPreviewError(null);

    try {
      const text = await file.text();
      let meta: FlutterMeta;
      try {
        meta = JSON.parse(text) as FlutterMeta;
      } catch (err: any) {
        setError(err?.message || 'JSON 解析失败，请检查文件内容');
        return;
      }

      // sync available languages from uploaded meta (if present)
      if (Array.isArray(meta.availableLanguages) && meta.availableLanguages.length > 0) {
        setAvailableLanguages(meta.availableLanguages);
        if (!meta.availableLanguages.includes(language)) {
          setLanguage(meta.availableLanguages[0]);
        }
      }

      // Allow overriding / enforcing platform & language from UI
      meta.platform = platform;
      meta.language = language;

      const res = await fetch('/api/flutter/page-objects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(meta),
        credentials: 'include',
      });

      if (!res.ok) {
        const msg = await extractErrorMessage(res, '生成 Flutter PageObject 失败');
        setError(msg);
        return;
      }

      const data = (await res.json()) as GenerateResult;
      setResult(data);
      // Use server-returned meta (which may normalize platform/language)
      setUploadedMeta({
        ...meta,
        platform: data.platform ?? meta.platform,
        language: data.language ?? meta.language,
      } as FlutterMeta);
      setSourceKind('upload');
      setCurrentBranchSanitized(data.sanitizedBranch ?? null);
    } catch (err: any) {
      setError(err?.message || '生成 Flutter PageObject 失败');
    } finally {
      setUploading(false);
    }
  };

  const loadMetaFiles = async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const res = await fetch('/api/flutter/meta', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        const msg = await extractErrorMessage(res, '加载 Flutter 元数据列表失败');
        setMetaError(msg);
        setMetaFiles([]);
        return;
      }
      const data = (await res.json()) as MetaFileInfo[] | any;
      if (Array.isArray(data)) {
        setMetaFiles(
          data.map((it) => ({
            sanitizedBranch: String(it.sanitizedBranch ?? ''),
            branch: it.branch ?? null,
            filePath: String(it.filePath ?? ''),
            platform: (it.platform ?? null) as string | null,
            language: (it.language ?? null) as string | null,
          })),
        );
      } else {
        setMetaFiles([]);
      }
    } catch (err: any) {
      setMetaError(err?.message || '加载 Flutter 元数据列表失败');
      setMetaFiles([]);
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadMetaFiles();
    }
  }, [isAuthenticated]);

  const handleGenerateFromBranch = async (sanitizedBranch: string) => {
    if (!isAuthenticated) {
      setError('请先登录后再生成 Flutter PageObject');
      setResult(null);
      return;
    }
    if (!sanitizedBranch) return;
    setUploading(true);
    setError(null);
    setResult(null);
    setUploadedMeta(null);
    setSourceKind(null);
    setPreviewPage(null);
    setPreviewError(null);
    try {
      // Load meta first to sync availableLanguages (and possibly platform/language defaults)
      try {
        const metaRes = await fetch(
          `/api/flutter/meta/${encodeURIComponent(sanitizedBranch)}`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          },
        );
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as FlutterMeta;
          if (Array.isArray(meta.availableLanguages) && meta.availableLanguages.length > 0) {
            setAvailableLanguages(meta.availableLanguages);
            if (!meta.availableLanguages.includes(language)) {
              setLanguage(meta.availableLanguages[0]);
            }
          }
          if (meta.platform && !platform) {
            setPlatform(
              meta.platform === 'ios' ? 'ios' : 'android',
            );
          }
        }
      } catch {
        // ignore meta fetch failure, generation may still succeed
      }

      const res = await fetch('/api/flutter/page-objects/by-branch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sanitizedBranch, platform, language }),
      });
      if (!res.ok) {
        const msg = await extractErrorMessage(res, '生成 Flutter PageObject 失败');
        setError(msg);
        return;
      }
      const data = (await res.json()) as GenerateResult;
      setResult(data);
      setSourceKind('branch');
      setUploadedMeta(null);
      setCurrentBranchSanitized(data.sanitizedBranch ?? sanitizedBranch);
    } catch (err: any) {
      setError(err?.message || '生成 Flutter PageObject 失败');
    } finally {
      setUploading(false);
    }
  };

  const pages = Array.isArray(result?.pages) ? result!.pages : [];

  const handlePreviewPage = async (page: GeneratedPageInfo) => {
    setPreviewError(null);
    setPreviewPage(null);

    // 优先使用上传的 JSON
    if (sourceKind === 'upload' && uploadedMeta) {
      const raw =
        uploadedMeta.pages?.find(
          (p) =>
            p.pageClass === page.dartPageClass ||
            p.pageFile === page.dartFile,
        ) ?? null;
      if (!raw) {
        setPreviewError('在上传的 JSON 中未找到对应页面元数据');
        return;
      }
      setPreviewPage({ page, raw });
      return;
    }

    // 其次从服务器按分支加载
    const branch = currentBranchSanitized || result?.sanitizedBranch || null;
    if (!branch) {
      setPreviewError('当前结果缺少分支信息，无法加载原始 JSON');
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/flutter/meta/${encodeURIComponent(branch)}`,
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        },
      );
      if (!res.ok) {
        const msg = await extractErrorMessage(
          res,
          '加载原始 JSON 失败',
        );
        setPreviewError(msg);
        return;
      }
      const meta = (await res.json()) as FlutterMeta;
      const raw =
        meta.pages?.find(
          (p) =>
            p.pageClass === page.dartPageClass ||
            p.pageFile === page.dartFile,
        ) ?? null;
      if (!raw) {
        setPreviewError('在服务器 JSON 中未找到对应页面元数据');
        return;
      }
      setPreviewPage({ page, raw });
    } catch (err: any) {
      setPreviewError(err?.message || '加载原始 JSON 失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRegenerateWithLanguage = async () => {
    if (!isAuthenticated) {
      setError('请先登录后再生成 Flutter PageObject');
      setResult(null);
      return;
    }
    if (!result) {
      setError('当前没有可复用的生成结果');
      return;
    }

    setUploading(true);
    setError(null);
    setPreviewError(null);
    setPreviewPage(null);

    try {
      // Case 1: 来自上传的 JSON，直接复用 uploadedMeta
      if (sourceKind === 'upload' && uploadedMeta) {
        const meta: FlutterMeta = {
          ...uploadedMeta,
          platform,
          language,
        };
        const res = await fetch('/api/flutter/page-objects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(meta),
          credentials: 'include',
        });
        if (!res.ok) {
          const msg = await extractErrorMessage(res, '生成 Flutter PageObject 失败');
          setError(msg);
          return;
        }
        const data = (await res.json()) as GenerateResult;
        setResult(data);
        setUploadedMeta({
          ...meta,
          platform: data.platform ?? meta.platform,
          language: data.language ?? meta.language,
        } as FlutterMeta);
        setSourceKind('upload');
        setCurrentBranchSanitized(data.sanitizedBranch ?? currentBranchSanitized);
        return;
      }

      // Case 2: 来自服务器分支列表，按 branch + 语言重新生成
      if (sourceKind === 'branch' && currentBranchSanitized) {
        const res = await fetch('/api/flutter/page-objects/by-branch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sanitizedBranch: currentBranchSanitized,
            platform,
            language,
          }),
        });
        if (!res.ok) {
          const msg = await extractErrorMessage(res, '生成 Flutter PageObject 失败');
          setError(msg);
          return;
        }
        const data = (await res.json()) as GenerateResult;
        setResult(data);
        setSourceKind('branch');
        setUploadedMeta(null);
        setCurrentBranchSanitized(data.sanitizedBranch ?? currentBranchSanitized);
        return;
      }

      setError('当前结果来源未知，无法复用 JSON 重新生成');
    } catch (err: any) {
      setError(err?.message || '生成 Flutter PageObject 失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div>
        <h1 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <FileCode2 className="w-5 h-5" />
          Flutter PageObject 生成器
        </h1>
        <p className="text-sm text-muted-foreground">
          第一步使用后端脚本 <code>scripts/scan-flutter-pages.js</code>{' '}
          扫描 Flutter 工程生成 JSON 表格；第二步在这里上传该 JSON，后端会在
          <code>
            {' '}
            apps/api/workspace/shared-libs/gettr-android/src/&lt;分支名&gt;/&lt;语言&gt;{' '}
          </code>
          下生成对应的 TS PageObject 类（同时在
          <code> src/&lt;分支名&gt;/index.ts </code>
          中默认导出该语言），并在下方表格展示生成结果。
        </p>
      </div>

      <div className="space-y-3 max-w-4xl">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">服务器上已有的 Flutter 页面 JSON 表格</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadMetaFiles}
            disabled={metaLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            刷新列表
          </Button>
        </div>
        {metaError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {metaError}
          </div>
        )}
        {metaLoading && (
          <div className="text-xs text-muted-foreground">加载中...</div>
        )}
        {!metaLoading && metaFiles.length === 0 && (
          <div className="text-xs text-muted-foreground">
            暂无扫描结果。请先在后端仓库运行{' '}
            <code>node scripts/scan-flutter-pages.js</code> 生成 JSON 表格。
          </div>
        )}
        {metaFiles.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1 text-left whitespace-nowrap">
                      分支
                    </th>
                    <th className="px-2 py-1 text-left whitespace-nowrap">
                      平台 / 语言
                    </th>
                    <th className="px-2 py-1 text-left whitespace-nowrap">
                      文件
                    </th>
                    <th className="px-2 py-1 text-left whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metaFiles.map((m) => (
                    <tr
                      key={m.filePath}
                      className="border-t hover:bg-muted/40"
                    >
                      <td className="px-2 py-1 align-middle">
                        <div className="font-mono text-[11px]">
                          {m.branch || '(unknown branch)'}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {m.sanitizedBranch}
                        </div>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {(m.platform || 'android') +
                            (m.language ? ` / ${m.language}` : '')}
                        </div>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <div className="font-mono text-[10px] break-all text-muted-foreground">
                          {m.filePath}
                        </div>
                      </td>
                      <td className="px-2 py-1 align-middle">
                        <Button
                          type="button"
                          size="xs"
                          disabled={uploading}
                          onClick={() =>
                            handleGenerateFromBranch(m.sanitizedBranch)
                          }
                        >
                          使用该表格生成
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div className="flex gap-2">
          <div className="space-y-1">
            <Label className="text-xs">平台 (platform)</Label>
            <select
              className="border rounded px-2 py-1 text-xs bg-background"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as 'android' | 'ios')}
            >
              <option value="android">android</option>
              <option value="ios">ios</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">语言 (language)</Label>
            <select
              className="border rounded px-2 py-1 text-xs bg-background"
              value={language}
              onChange={(e) => setLanguage(e.target.value || 'en')}
            >
              {availableLanguages.length === 0 && (
                <option value="en">en</option>
              )}
              {availableLanguages.map((lng) => (
                <option key={lng} value={lng}>
                  {lng}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="flutter-meta-file">选择 Flutter 页面 JSON 表格</Label>
          <Input
            id="flutter-meta-file"
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
          />
          <p className="text-xs text-muted-foreground">
            文件应为 <code>scripts/scan-flutter-pages.js</code>{' '}
            生成的 <code>*.json</code>，包含字段：branch, pages[pageClass, pageFile,
            controls...]。
          </p>
        </div>

        <Button
          type="submit"
          disabled={!file || uploading}
          className="flex items-center gap-2"
        >
          <UploadCloud className="w-4 h-4" />
          {uploading ? '生成中...' : '上传并生成 PageObject'}
        </Button>
      </form>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive max-w-xl">
          {error}
        </div>
      )}

      {result && !error && (
        <div className="mt-2 space-y-3">
          <div className="text-sm">
            分支：
            <span className="font-mono">
              {result.branch} ({result.sanitizedBranch})
            </span>
          </div>
          <div className="text-sm">
            输出目录：
            <span className="font-mono">{result.outDir}</span>
          </div>
          <div className="text-sm">
            生成文件数：
            <span className="font-mono">{pages.length}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span>
              当前生成：
              <span className="font-mono ml-1">
                {(result.platform || platform) +
                  (result.language ? ` / ${result.language}` : language ? ` / ${language}` : '')}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={handleRegenerateWithLanguage}
            >
              仅修改平台/语言重新生成
            </Button>
          </div>

          {pages.length > 0 && (
            <div className="mt-2 border rounded-md overflow-hidden">
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1 text-left whitespace-nowrap">
                        TS 类 / 文件
                      </th>
                      <th className="px-2 py-1 text-left whitespace-nowrap">
                        Dart 页面
                      </th>
                      <th className="px-2 py-1 text-left whitespace-nowrap">
                        方法数
                      </th>
                      <th className="px-2 py-1 text-left whitespace-nowrap">
                        方法/功能预览
                      </th>
                      <th className="px-2 py-1 text-left whitespace-nowrap">
                        扫描 JSON
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((p) => (
                    <tr
                      key={p.filePath}
                      className="border-t hover:bg-muted/40 align-top"
                    >
                      <td className="px-2 py-1">
                        <div className="font-mono text-[11px] flex items-center gap-2">
                          <span>{p.tsClass}</span>
                          {p.isEntry && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              ENTRY
                            </span>
                          )}
                        </div>
                          <div className="font-mono text-[10px] text-muted-foreground break-all">
                            {p.filePath}
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <div className="font-mono text-[11px]">
                            {p.dartPageClass}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground break-all">
                            {p.dartFile}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-center align-middle">
                          <span className="font-mono">
                            {Array.isArray(p.methods) ? p.methods.length : 0}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          <div className="space-y-1">
                            {(p.methods || []).slice(0, 4).map((m) => (
                              <div
                                key={m.name}
                                className={cn(
                                  'flex flex-col gap-0.5 rounded border bg-background px-2 py-1',
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[11px]">
                                    {m.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    → {m.returnType}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground line-clamp-2">
                                  {m.description}
                                </div>
                                {(m.selectorType || m.targetPageClass || m.targetRoute) && (
                                  <div className="text-[10px] text-muted-foreground/80">
                                    {m.selectorType && m.selector && (
                                      <span>
                                        Sel({m.selectorType}):{' '}
                                        <span className="font-mono">
                                          {m.selector}
                                        </span>
                                      </span>
                                    )}
                                    {(m.targetPageClass || m.targetRoute) && (
                                      <span className="ml-2">
                                        目标:
                                        <span className="font-mono ml-1">
                                          {[
                                            m.targetPageClass
                                              ? `page=${m.targetPageClass}`
                                              : null,
                                            m.targetRoute
                                              ? `route=${m.targetRoute}`
                                              : null,
                                          ]
                                            .filter(Boolean)
                                            .join(', ')}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {Array.isArray(p.methods) &&
                              p.methods.length > 4 && (
                                <div className="text-[11px] text-muted-foreground">
                                  还有{' '}
                                  <span className="font-mono">
                                    {p.methods.length - 4}
                                  </span>{' '}
                                  个方法未在此展示…
                                </div>
                              )}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            className="flex items-center gap-1"
                            onClick={() => handlePreviewPage(p)}
                          >
                            <Eye className="w-3 h-3" />
                            预览原始 JSON
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(previewPage || previewError) && (
            <div className="mt-2 border rounded-md bg-muted/40">
              <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">
                  原始 JSON 预览
                  {previewPage?.page && (
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                      {previewPage.page.dartPageClass} ·{' '}
                      {previewPage.page.dartFile}
                    </span>
                  )}
                </div>
                {previewLoading && (
                  <div className="text-[11px] text-muted-foreground">
                    加载中...
                  </div>
                )}
              </div>
              <div className="p-3 max-h-80 overflow-auto text-[11px] font-mono">
                {previewError && (
                  <div className="text-destructive">{previewError}</div>
                )}
                {!previewError && previewPage?.raw && (
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(previewPage.raw, null, 2)}
                  </pre>
                )}
                {!previewError && !previewPage?.raw && !previewLoading && (
                  <div className="text-muted-foreground">
                    选择上方某个页面行，点击「预览原始 JSON」查看对应扫描结果。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
