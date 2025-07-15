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
import { FileNode } from './files/types';

const INITIAL_CODE = `import { TestCase, Test, WithBrowser} from 'test-case';
@Test()
@WithBrowser({headless:false})
class MyTest extends TestCase {
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
  const [testCase, setTestCase] = useState<string>('');
  const [openLog, setOpenLog] = useState(false);
  const { logs, connected, clientId, clearLogs, running, setRunning } =
    useSocket();
  const { isAuthenticated } = useSession();
  const monacoRef = useRef<Monaco>(null);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    fetch(`/api/files/testmodule`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((content: any) => {
        setTestCase(content['content']);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    if (testCase !== '' && monacoRef.current) {
      monacoRef.current.languages.typescript.typescriptDefaults.addExtraLib(
        `declare module "test-case" { ${testCase} }`,
        'test-case.d.ts',
      );
    }
    return () => {
      setMonacoInited(false);
    };
  }, [testCase, monacoInited]);
  const run = useCallback(
    async (node?: FileNode, cId?: string) => {
      clearLogs();
      let runPath = currentFile;
      if (node) {
        runPath = node.path;
      }
      let clientIdd = clientId;
      if (cId) {
        clientIdd = cId;
      }
      await fetch(
        `/api/testcase/bundle?scriptpath=${encodeURIComponent(runPath)}&clientId=${clientIdd}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      setOpenLog(true);
    },
    [currentFile, clientId],
  );

  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco: Monaco) => {
      if (!monaco || !editor) return;
      monacoRef.current = monaco;
      setMonacoInited(true);
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        'declare module "my-module" { export function myFunc(): void; }',
        'my-module.d.ts',
      );
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
        } else if (
          log.includes('success') ||
          log.includes('Success') ||
          log.includes('finished') ||
          log.includes('passed')
        ) {
          color = 'green';
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
            currentDir={currentDir}
            refreshKey={refreshKey}
            setRefreshKey={setRefreshKey}
            onSelect={setCurrentFile}
            onDirSelect={setCurrentDir}
            collapsible={false}
            run={run}
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
            run={run}
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
