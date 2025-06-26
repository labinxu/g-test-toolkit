'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Switch } from '@/components/ui/switch'; // shadcn/ui Switch
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { OnMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import DirectoryTreePanel from '@/components/files/directory-tree-panel';
import FileEditor from '@/components/files/file-editor';
import { useQuery } from '@tanstack/react-query';
import io, { Socket } from 'socket.io-client';

const INITIAL_CODE = `import { TestCase, Regist } from 'test-case';
@Regist()
class MyTest extends TestCase {
  async test() {
    this.print('Test executed');
  }
}
`;
const headers = { 'Content-Type': 'application/json' };
let socket: Socket | null = null;
export default function Page() {
  const [currentFile, setCurrentFile] = useState('');
  const [currentDir, setCurrentDir] = useState('./user-cases/cases');
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [monacoInited, setMonacoInited] = useState<boolean>(false);
  const [testCase, setTestCase] = useState<string>('');
  const [useBrowser, setUseBrowser] = useState(true);
  const [clientId, setClientId] = useState<string | undefined>();
  const monacoRef = useRef<Monaco>(null);

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
    return () => {
      setMonacoInited(false);
    };
  }, [testCase, monacoInited]);
  useEffect(() => {
    // 连接到 NestJS WebSocket Gateway
    socket = io('http://localhost:3001/log');
    if (!socket) {
      console.log(`can not connect server`);
      return;
    }
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected:', socket?.id);
      setClientId(socket?.id);
      // 可发送 hello 消息给服务端
      socket?.emit('hello', 'Hello from Next.js client!');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected');
    });

    socket.on('log', (msg: string) => {
      setLogs((prev) => [...prev, msg]);
    });
    socket.on('hello', (msg: string) => {
      console.log('hello from server', JSON.parse(msg));
    });
    socket.on('ctl', (msg: string) => {
      console.log('ctl message from server', msg);
      if (msg.toLocaleLowerCase() === 'exit') {
        console.log('set running to false');
        setRunning(false);
      }
    });

    return () => {
      socket?.disconnect();
    };
  }, []);

  const run = async () => {
    setLogs([]);
    await fetch('/api/testcase/run/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, useBrowser, clientId: clientId }),
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
          currentDir={currentDir}
          onSelect={setCurrentFile}
          onDirSelect={setCurrentDir}
        />
      </div>
      <div className="flex-1 pl-4 h-full min-w-0 flex flex-col transition-all duration-300">
        <FileEditor
          template={INITIAL_CODE}
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
              <Switch
                id="run-in-browser"
                checked={useBrowser}
                onCheckedChange={setUseBrowser}
              />
            </div>
            <div>
              {currentFile ? (
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
              ) : null}
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
