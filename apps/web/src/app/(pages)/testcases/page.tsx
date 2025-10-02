'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { OnMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import DirectoryTreePanel from '@/components/files/directory-tree-panel';
import { ScriptEditor } from '@/components/files/script-editor';
import { Control } from './control';
import { OutputPanel } from '@/components/output-panel';
import { useSocket } from './socket-content';
import { useSession } from '@/app/context/session-context';
import NewFileOrFolder from '@/components/files/new-file-folder';
import DirectoryTree from './files/directory-tree';
import { toast } from 'sonner';

const INITIAL_CODE = `import { TestCase, Test, WithBrowser} from 'core-lib';
@Test()
@WithBrowser({headless:false})
class MyTest extends TestCase {
constructor(){LOGGER.info('hello test')}
  async test_demo() {
    this.print('Test executed');
  }
}
`;
export default function Page() {
  const [currentFile, setCurrentFile] = useState('');
  const [currentDir, setCurrentDir] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [monacoInited, setMonacoInited] = useState<boolean>(false);
  const [openLog, setOpenLog] = useState(false);
  const { logs, connected, clientId, clearLogs, running, setRunning } =
    useSocket();
  const { isAuthenticated } = useSession();
  const monacoRef = useRef<Monaco>(null);
  useEffect(() => {
    if (!isAuthenticated || !monacoInited || !monacoRef.current) {
      return;
    }
    fetch(`/api/testcase/interfaces`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: { [key: string]: string }[]) => {
        data.forEach((item) => {
          Object.entries(item).forEach(([key, val]) => {
            monacoRef.current?.languages.typescript.typescriptDefaults.addExtraLib(
              `declare module "${key}" { ${val} }`,
              `${key}.d.ts`,
            );
            console.log(`addextralib: declare module ${key} { ${val} }`);
          });
        });
      });
  }, [isAuthenticated, monacoInited]);
  const runPath = useCallback(async () => {
    clearLogs();
    // 1) fetch csrf token first (cookie must be present and credentials included)
    const csrfResp = await fetch(`/api/csrf-token`, { credentials: 'include' });
    const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null;
    const csrfToken = csrf?.token;

    // 2) then POST with X-CSRF-Token
    fetch(`/api/testcase/runpath`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify({ filePath: currentFile, clientId }),
    })
      .then((resp) => {
        if (resp.ok) {
          toast.message('Start succefull...');
        }
      })
      .catch((err) => {});
    setOpenLog(true);
  }, [currentFile, clientId]);

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco: Monaco) => {
      if (!monaco || !editor) return;
      monacoRef.current = monaco;
      setMonacoInited(true);

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        typeRoots: ['node_modules/@types'],
      });
    },
    [],
  );
  const renderLogs = () => {
    return logs.map((log, index) => {
      let color = '';
      try {
        if (log.includes('error') || log.includes('Error')) {
          color = 'red';
        } else if (
          log.includes('success') ||
          log.includes('Success') ||
          log.includes('finished') ||
          log.includes('passed')
        ) {
          color = 'green';
        } else if (log.includes('[info]')) {
          color = '#3B82F6';
        } else if (log.includes('debug')) {
          color = '#6B7280';
        } else if (log.includes('[warn]')) {
          color = '#F59E0B';
        }
      } catch (err) {
        console.log(logs);
        console.log(err);
      }
      return (
        <div key={index} style={{ color, margin: 0 }}>
          {log}
        </div>
      );
    });
  };
  return (
    <div className="flex w-full gap-0  rounded-lg flex-1">
      <div className="h-full flex flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel>
          <NewFileOrFolder
            key={currentDir}
            parentDir={currentDir}
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
          <DirectoryTree
            api={'/api/testcase/listcases?&depth=3'}
            currentDir={currentDir}
            refreshKey={refreshKey}
            setRefreshKey={setRefreshKey}
            onSelect={setCurrentFile}
            onDirSelect={setCurrentDir}
            collapsible={false}
            run={runPath}
          />
        </DirectoryTreePanel>
      </div>
      <div className="flex-1 pl-4 h-full min-w-0 flex flex-col transition-all duration-300 min-h-0">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0">
            <ScriptEditor
              filePath={currentFile}
              onMount={handleEditorDidMount}
            />
          </div>
          <Control
            currentFile={currentFile}
            running={running}
            connected={connected}
            setRunning={setRunning}
            run={runPath}
          />
          <OutputPanel
            renderLogs={renderLogs}
            open={openLog}
            setOpen={setOpenLog}
          />
        </div>
      </div>
    </div>
  );
}
