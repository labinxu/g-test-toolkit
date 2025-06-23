'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Switch } from '@/components/ui/switch'; // shadcn/ui Switch
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Editor, { OnMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import DirectoryTreePanel from '@/components/files/directory-tree-panel';
import FileEditor from '@/components/files/file-editor';
import { useQuery } from '@tanstack/react-query';

const INITIAL_CODE = `import { TestCase, Regist } from 'test-case';
@Regist()
class MyTest extends TestCase {
  async test() {
    this.configurePhone('0A171FDD40063C','holding display','125698',"300 900 300 200")
    await this.screenOn();
    this.print('Test executed');
  }
}
`;
const headers = { 'Content-Type': 'application/json' };

export default function Page() {
  const [currentFile, setCurrentFile] = useState('');
  const [currentDir, setCurrentDir] = useState('./user-cases');
  const [refreshKey, setRefreshKey] = useState(0);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [monacoInited, setMonacoInited] = useState<boolean>(false);
  const [testCase, setTestCase] = useState<string>('');

  const monacoRef = useRef<Monaco>(null);
  const editorRef = useRef<typeof Editor>(null);

  const testcaseQuery = useQuery({
    queryKey: ['init'],
    queryFn: () =>
      fetch(`/api/testcase/init`, {
        method: 'GET',
        //credentials: "include",
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
    if (running) run();
  }, [running]);
  useEffect(() => {
    if (testCase !== '' && monacoRef.current) {
      // Add test-case.d.ts as a module
      monacoRef.current.languages.typescript.typescriptDefaults.addExtraLib(
        `declare module "test-case" { ${testCase} }`,
        'test-case.d.ts',
      );
    }
  }, [testCase, monacoInited]);

  const run = async () => {
    setLogs([]);
    const res = await fetch('/api/testcase/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  };
  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco: Monaco) => {
      if (!monaco || !editor) return;
      editorRef.current = editor;
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
  const handleEditorChange = useCallback((value?: string) => {
    setCode(value ?? '');
  }, []);

  const renderLogs = () => {
    return logs.map((log, index) => {
      let color = 'black';
      if (log.includes('error') || log.includes('Error')) {
        color = 'red';
      } else if (
        log.includes('success') ||
        log.includes('Success') ||
        log.includes('finished')
      ) {
        color = 'green';
      }
      return (
        <div key={index} style={{ color, margin: 0 }}>
          {log}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-full gap-0 m-4 rounded-lg">
      <div className="h-full flex flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel
          key={refreshKey}
          onSelect={setCurrentFile}
          onDirSelect={setCurrentDir}
          onCollapseChange={setTreeCollapsed}
        />
      </div>
      <div className="flex-1 pl-4 h-full min-w-0 flex flex-col transition-all duration-300">
        <FileEditor
          filePath={currentFile}
          onMount={handleEditorDidMount}
          content={code}
          setContent={setCode}
        />
        <div className="rounded-lg shadow-sm basis-2/5 flex flex-col min-h-0">
          <div className="flex justify-between items-center m-1 rounded-lg shadow-sm ">
            <div className="flex items-center gap-2 m-1">
              <Label htmlFor="run-in-browser" className="mr-2">
                RUN IN BROWSER
              </Label>
              <Switch id="run-in-browser" />
            </div>
            <div>
              <Button
                variant={'outline'}
                size={'sm'}
                onClick={() => {
                  if (running) return;
                  setRunning(!running);
                }}
              >
                {!running ? 'Execute' : 'Running'}
              </Button>
            </div>
            <div className="flex flex-row m-1 gap-3">
              <strong>Server Status:</strong>{' '}
              <span style={{ color: connected ? 'green' : 'red' }}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex flex-col flex-1 min-h-0 m-1 rounded-lg shadow-sm ">
            <span className="font-medium mb-1">Output:</span>
            <div
              id="console"
              className="w-full h-full p-2 border rounded-md bg-gray-50 overflow-auto"
              contentEditable={false}
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '14px',
              }}
            >
              {renderLogs()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
