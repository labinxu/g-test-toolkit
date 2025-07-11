'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { OnMount } from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import DirectoryTreePanel from '@/components/files/directory-tree-panel';
import { ScriptEditor } from '@/components/files/script-editor';
import io, { Socket } from 'socket.io-client';

let socket: Socket | null = null;
export default function Page() {
  const [currentFile, setCurrentFile] = useState('');
  const [currentDir, setCurrentDir] = useState('./user-cases/commands');
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [scripts, setScripts] = useState<string>('');
  useEffect(() => {
    if (running) run();
  }, [running]);
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
      if (msg === 'END') {
        console.log('set running to false');
        setRunning(false);
      }
    });
    socket.on('stdout', (msg) => setLogs((prev) => [...prev, msg]));
    socket.on('stderr', (msg) => setLogs((prev) => [...prev, msg]));
    socket.on('close', (msg) => {
      setLogs((prev) => [...prev, msg]);
      setRunning(false);
    });

    return () => {
      socket?.disconnect();
    };
  }, []);

  const run = async () => {
    if (!socket || scripts === '') {
      setLogs(['ERROR: Socket not initialized!']);
      return;
    }
    setLogs(['RUN Script']);

    socket.emit('run-script', scripts);
  };
  const handleEditorDidMount: OnMount = useCallback(
    (editor, monaco: Monaco) => {
      if (!monaco || !editor) return;
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
    <div className="flex h-full w-full gap-0  rounded-lg">
      <div className="h-full flex flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel
          currentDir={currentDir}
          onSelect={setCurrentFile}
          onDirSelect={setCurrentDir}
        />
      </div>
      <div className="flex-1 pl-4 h-full min-w-0 flex flex-col transition-all duration-300">
        <ScriptEditor filePath={currentFile} onMount={handleEditorDidMount} />
        <div className="rounded-lg shadow-sm basis-2/5 flex flex-col min-h-0">
          <div className="flex justify-between items-center rounded-lg shadow-sm ">
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
            <div className="flex flex-row gap-3">
              <strong>Server Status:</strong>{' '}
              <span style={{ color: connected ? 'green' : 'red' }}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex flex-col flex-1 min-h-0 rounded-lg shadow-sm ">
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
