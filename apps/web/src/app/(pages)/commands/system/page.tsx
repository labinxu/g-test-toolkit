'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import MonacoScriptEditor, { type MonacoScriptEditorHandle } from '@/components/files/monaco-script-editor'
import io, { Socket } from 'socket.io-client'

let socket: Socket | null = null
export default function Page() {
  const [currentFile, setCurrentFile] = useState('')
  const [currentDir, setCurrentDir] = useState('./bin')
  const [logs, setLogs] = useState<string[]>([])
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [scripts, setScripts] = useState<string>('')
  const editorRef = useRef<MonacoScriptEditorHandle | null>(null)
  useEffect(() => {
    if (running) run()
  }, [running])
  useEffect(() => {
    // 连接到 NestJS WebSocket Gateway
    socket = io('http://localhost:3001/log')
    if (!socket) {
      console.log(`can not connect server`)
      return
    }
    socket.on('connect', () => {
      setConnected(true)
      console.log('Connected:', socket?.id)
      // 可发送 hello 消息给服务端
      socket?.emit('hello', 'Hello from Next.js client!')
    })

    socket.on('disconnect', () => {
      setConnected(false)
      console.log('Disconnected')
    })

    socket.on('log', (msg: string) => {
      setLogs((prev) => [...prev, msg])
    })
    socket.on('hello', (msg: string) => {
      console.log('hello from server', msg)
    })
    socket.on('ctl', (msg: string) => {
      console.log('ctl message from server', msg)
      if (msg === 'END') {
        console.log('set running to false')
        setRunning(false)
      }
    })
    socket.on('stdout', (msg) => setLogs((prev) => [...prev, msg]))
    socket.on('stderr', (msg) => setLogs((prev) => [...prev, msg]))
    socket.on('close', (msg) => {
      setLogs((prev) => [...prev, msg])
      setRunning(false)
    })

    return () => {
      socket?.disconnect()
    }
  }, [])

  const run = async () => {
    if (!socket || scripts === '') {
      setLogs(['ERROR: Socket not initialized!'])
      return
    }
    setLogs(['RUN Script'])

    socket.emit('run-script', scripts)
  }
  const renderLogs = () => {
    return logs.map((log, index) => {
      let color = 'black'
      if (log.includes('error') || log.includes('Error')) {
        color = 'red'
      } else if (log.includes('success') || log.includes('Success') || log.includes('finished')) {
        color = 'green'
      }
      return (
        <div key={index} style={{ color, margin: 0 }}>
          {log}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full w-full gap-0 rounded-lg">
      <div className="flex h-full flex-col" style={{ minWidth: 0 }}>
        <DirectoryTreePanel
          currentDir={currentDir}
          onSelect={setCurrentFile}
          onDirSelect={setCurrentDir}
        />
      </div>
      <div className="flex h-full min-w-0 flex-1 flex-col pl-4 transition-all duration-300">
        <MonacoScriptEditor
          ref={editorRef}
          filePath={currentFile}
          onContentChange={(value) => setScripts(value)}
        />
        <div className="flex min-h-0 basis-2/5 flex-col rounded-lg shadow-sm">
          <div className="flex items-center justify-between rounded-lg shadow-sm">
            <div>
              <Button
                variant={'outline'}
                size={'sm'}
                onClick={() => {
                  if (running) return
                  setRunning(!running)
                }}
              >
                {!running ? 'Execute' : 'Running'}
              </Button>
            </div>
            <div className="flex flex-row gap-3">
              <strong>Status:</strong>{' '}
              <span style={{ color: connected ? 'green' : 'red' }}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-lg shadow-sm">
            <span className="mb-1 font-medium">Output:</span>
            <div
              id="console"
              className="h-full w-full overflow-auto rounded-md border bg-gray-50 p-2"
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
  )
}
