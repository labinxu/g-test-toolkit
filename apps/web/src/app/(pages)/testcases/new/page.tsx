'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import Editor, { OnMount } from '@monaco-editor/react';

import type { Monaco } from '@monaco-editor/react';
import io, { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import dynamic from 'next/dynamic';
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });


const INITIAL_CODE = `import { TestCase, Regist } from 'test-case';
@Regist()
class MyTest extends TestCase {
  async test() {
    this.configurePhone('0A171FDD40063C','holding display','125698',"300 900 300 200")
    await this.screenOn();
    this.print('Test executed');
  }
}
`
const headers = { 'Content-Type': 'application/json' };
let socket: Socket | null = null;
const Page: React.FC = () => {
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [monacoInited, setMonacoInited] = useState<boolean>(false);
  const [testCase, setTestCase] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const monacoRef = useRef<Monaco>(null);
  const editorRef = useRef<typeof Editor>(null);
  const openRef = useRef();
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
    // 连接到 NestJS WebSocket Gateway
    socket = io('http://localhost:3001/log');
    if (!socket) {
      console.log(`can not connect server`);
      return;
    }
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected:', socket?.id);
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
      console.log('hello from server', msg);
    });
    socket.on('ctl', (msg: string) => {
      console.log('ctl message from server', msg);
      if(msg==='END'){
        console.log('set running to false')
        setRunning(false)
      }

    });

    return () => {
      socket?.disconnect();
    };
  }, []);
  useEffect(() => {
    if (testcaseQuery.isPending) return;
    const { content } = testcaseQuery.data;
    setTestCase(content);
  }, [testcaseQuery]);

  useEffect(() => {
    if (testCase !== '' && monacoRef.current) {
      // Add test-case.d.ts as a module
      monacoRef.current.languages.typescript.typescriptDefaults.addExtraLib(
        `declare module "test-case" { ${testCase} }`,
        'test-case.d.ts',
      );
      // Log registered libs for debugging
      // console.log(
      //   'Extra libs:',
      //   monacoRef.current.languages.typescript.typescriptDefaults.getExtraLibs(),
      // );
    }
  }, [testCase, monacoInited]);

  // 编辑器挂载时初始化
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
  // 编辑器内容变化
  const handleEditorChange = useCallback((value?: string) => {
    setCode(value ?? '');
  }, []);
  useEffect(() => {
    if (running) run();
  }, [running]);
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
  function handleSave() {
    const content = editorRef.current?.getValue();
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "MyTestCase.ts";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    console.log('===========',file)
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      editorRef.current?.setValue(evt.target.result);
    };
    reader.readAsText(file);
  }
  function handleOpen(){
    openRef.current?.click()
  }
  return (
    <div className="rounded-lg shadow-sm flex flex-col h-full m-4">
      <div className="rounded-lg shadow-sm flex flex-row m-1 gap-3 justify-end">
        <>
          <input type="file" onChange={handleFileChange} ref={openRef} style={{ display: "none" }}/>
        <Button variant={'outline'} size={'sm'} onClick={handleOpen}>Open</Button>
        </>
                <Button variant={'outline'} size={"sm"} onClick={handleSave}>Save</Button>
        <Button variant={'outline'} size={'sm'}>Upload</Button>
      </div>
      <div className="flex-1 basis-3/5 min-h-0 m-1">
        <MonacoEditor
          height="100%"
          language="typescript"
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 16,
          }}
        />
      </div>
      <div className="rounded-lg shadow-sm basis-2/5 flex flex-col min-h-0">
        <div className="flex justify-between m-1 rounded-lg shadow-sm ">
          <div className="flex items-center gap-3 m-1">
            <Switch id="terms" />
            <Label htmlFor="terms">RUN IN BROWSER</Label>
          </div>
          <div>
            <Button
              variant={'outline'}
              size={'sm'}
              onClick={() => {
                if(running)return;
                setRunning(!running);
              }}
            >
              {!running?"Execute":"Running"}
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
  );
};

export default Page;
