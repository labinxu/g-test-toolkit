'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import ts from 'typescript';
import { useQuery } from '@tanstack/react-query';

import Editor, { OnMount } from '@monaco-editor/react';

import type { Monaco } from '@monaco-editor/react';
import io, { Socket } from 'socket.io-client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const INITIAL_CODE = '//Test Case';
const headers = { 'Content-Type': 'application/json' };
let socket: Socket | null = null;
const Page: React.FC = () => {
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [testCase, setTestCase] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
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
    // 连接到 NestJS WebSocket Gateway
    socket = io('http://localhost:3001/log');
    if(!socket){
      console.log(`can not connect server`)
      return;
    }
    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected:', socket.id);
      // 可发送 hello 消息给服务端
      socket.emit('hello', 'Hello from Next.js client!');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected');
    });

    socket.on('log', (msg: string) => {
      setLogs(prev => [...prev, msg]);
    });
    socket.on('hello',(msg:string)=>{
      setLogs(prev=>[...prev, msg])
    })
    // 清理
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
    if (testCase !== '') {
      monacoRef.current?.languages.typescript.typescriptDefaults.addExtraLib(
        testCase,
        'file:///node_modules/@types/test-case.d.ts',
      );
    }
  }, [testCase]);
  const transpile = useCallback(() => {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2017,
      },
    });
    return result.outputText;
  }, [code]);

  // 编辑器挂载时初始化
  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco: Monaco) => {
      if (!monaco) return;
      monacoRef.current = monaco;

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

  return (
    <div className="rounded-lg shadow-sm flex flex-col h-full m-4">
      <div className="flex-1 basis-3/5 min-h-0 m-1">
        <Editor
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
          <div className="flex items-center gap-3">
            <Switch id="terms" />
            <Label htmlFor="terms">RUN IN BROWSER</Label>
          </div>
          <div>
        <strong>Server Status:</strong>{' '}
        <span style={{ color: connected ? 'green' : 'red' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
          <Button variant={'link'} onClick={run}>
            Run
          </Button>
        </div>
        <div className="flex flex-col flex-1 min-h-0 m-1 rounded-lg shadow-sm ">
          <Label htmlFor="console">Output:</Label>
          <Textarea id="console" className="w-full h-full" value={logs} onChange={()=>{}}/>
        </div>
      </div>
    </div>
  );
};

export default Page;
