'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { OnMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import DirectoryTreePanel from '@/components/files/directory-tree-panel';
import FileEditor from '@/components/files/file-editor';
import { useQuery } from '@tanstack/react-query';
import { Control } from './control';
import { OutputPanel } from '@/components/output-panel';
import { useSocket } from './socket-content';

const INITIAL_CODE = `import { TestCase, Test, WithBrowser} from 'test-case';
@Test()
@WithBrowser({headless:false})
class MyTest extends TestCase {
  async test_demo() {
    this.print('Test executed');
  }
}
`;
const headers = { 'Content-Type': 'application/json' };
export default function Page() {
  const [currentFile, setCurrentFile] = useState('');
  const [currentDir, setCurrentDir] = useState('./user-cases/cases');
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [monacoInited, setMonacoInited] = useState<boolean>(false);
  const [testCase, setTestCase] = useState<string>('');
  const { logs, connected, clientId, clearLogs, running, setRunning } =
    useSocket();
  const monacoRef = useRef<Monaco>(null);

  const testcaseQuery = useQuery({
    queryKey: ['init'],
    queryFn: () =>
      fetch(`/api/testcase/init`, {
        method: 'GET',
        headers: { ...headers },
      }).then((res) => {
        if (res.ok) {
          return res.json();
        }
      }),
  });

  useEffect(() => {
    if (testcaseQuery.isPending) return;
    const { content } = testcaseQuery.data;
    setTestCase(content);
  }, [testcaseQuery]);

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

  const run = async () => {
    clearLogs();
    await fetch('/api/testcase/run/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, clientId: clientId }),
    });
  };
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
      let color = 'black';
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
    <div className="flex h-screen w-full gap-0  rounded-lg flex-1 min-h-0">
      <div className="h-full flex flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel
          currentDir={currentDir}
          onSelect={setCurrentFile}
          onDirSelect={setCurrentDir}
        />
      </div>
      <div className="flex-1 pl-4 h-full min-w-0 flex flex-col transition-all duration-300 min-h-0">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0">
            <FileEditor
              template={INITIAL_CODE}
              filePath={currentFile}
              onMount={handleEditorDidMount}
              content={code}
              setContent={setCode}
            />
          </div>
          <Control
            currentFile={currentFile}
            running={running}
            connected={connected}
            setRunning={setRunning}
            run={run}
          />
          <OutputPanel renderLogs={renderLogs} />
        </div>
      </div>
    </div>
  );
}
