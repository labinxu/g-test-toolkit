'use client';
import { useEffect, useState, useRef } from 'react';
//import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Save, Loader2 } from 'lucide-react';
import { useSession } from '@/app/context/session-context';
// const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
//   ssr: false,
// });
import { Editor, OnMount } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
export function ScriptEditor({
  filePath,
  onMount,
}: {
  onMount: OnMount;
  filePath: string;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('typescript');
  const lastLoadedPath = useRef<string | null>(null);
  const [content, setContent] = useState('');
  const { isAuthenticated } = useSession();
  const { theme } = useTheme();
  console.log('theme ', theme);
  // Load file content
  useEffect(() => {
    if (!filePath || !isAuthenticated) return;
    setLoading(true);
    setError(null);
    fetch(`/api/files/script?path=${encodeURIComponent(filePath)}`, {
      method: 'get',
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        setContent(data['content']);
        setChanged(false);
        lastLoadedPath.current = filePath;
      })
      .catch((e) => setError(e.message || 'Loading failed'))
      .finally(() => setLoading(false));
  }, [filePath, isAuthenticated]);

  // Save file
  async function save() {
    if (!filePath) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath, content }),
      });
      if (!res.ok) throw new Error('Save Failed');
      setChanged(false);
    } catch (e: any) {
      setError(e.message || 'Save Failed');
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S/Cmd+S 快捷保存
  useEffect(() => {
    if (filePath.endsWith('ts')) {
      setLanguage('typescript');
    } else if (filePath.endsWith('sh')) {
      setLanguage('bash');
    }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (!filePath || !changed || saving) return;
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filePath, changed, saving, content]);

  if (!filePath) {
    return (
      <div className="flex-1 flex h-full items-center justify-center text-lg rounded-xl shadow-lg ">
        <FileText className="w-6 h-6 mr-2" />
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full w-full rounded-xl shadow-lg">
      <div className="flex items-center gap-2 pb-2 ml-2">
        <Badge
          variant="outline"
          className="font-mono text-xs flex items-center px-2 py-1"
        >
          <FileText className="w-4 h-4 mr-1 text-gray-500" />
          {filePath}
        </Badge>
        <Button
          className="ml-2 flex items-center gap-1"
          onClick={save}
          disabled={saving || !changed}
          variant={changed ? 'default' : 'outline'}
          size="sm"
        >
          {saving ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : changed ? 'Save' : 'Saved'}
        </Button>
        {error && <span className="ml-4 text-red-500 text-xs">{error}</span>}
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <Skeleton className="w-full h-[60vh] rounded-xl" />
        ) : (
          <div className="rounded-xl overflow-hidden h-full shadow-lg mr-1">
            <Editor
              height="100%"
              language={language}
              value={content}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                readOnly: loading || saving,
              }}
              onMount={onMount}
              onChange={(v) => {
                setContent(v ?? '');
                setChanged(v !== undefined && v !== content);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
