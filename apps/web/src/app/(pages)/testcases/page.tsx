'use client'
import { useState, useCallback } from 'react'
import DirectoryTreePanel from '@/components/files/directory-tree-panel'
import { ScriptEditor } from '@/components/files/script-editor'
import { Control } from './control'
import { OutputPanel } from '@/components/output-panel'
import { useSocket } from './socket-content'
import NewFileOrFolder from '@/components/files/new-file-folder'
import DirectoryTree from './files/directory-tree'
import { toast } from 'sonner'

export default function Page() {
  const [currentFile, setCurrentFile] = useState('')
  const [currentDir, setCurrentDir] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [openLog, setOpenLog] = useState(false)
  const { logs, connected, clientId, clearLogs, running, setRunning } = useSocket()
  const [fileCache, setFileCache] = useState<
    Record<
      string,
      {
        content: string
        original: string
      }
    >
  >({})
  const runPath = useCallback(async () => {
    clearLogs()
    // 1) fetch csrf token first (cookie must be present and credentials included)
    const csrfResp = await fetch(`/api/csrf-token`, { credentials: 'include' })
    const csrf = csrfResp.ok ? ((await csrfResp.json()) as { token: string }) : null
    const csrfToken = csrf?.token

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
          toast.message('Start succefull...')
        }
      })
      .catch((err) => {})
    setOpenLog(true)
  }, [currentFile, clientId])
  const buildLibs = useCallback(async () => {
    fetch(`/api/testcase/buildlibs?clientId=${clientId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((resp) => {
        if (resp.ok) {
          toast.message('Building...')
        }
      })
      .catch((err) => {
        toast.error(`${err}`)
      })
  }, [clientId])

  const renderLogs = () => {
    return logs.map((log, index) => {
      let color = ''
      try {
        if (log.includes('error') || log.includes('Error')) {
          color = 'red'
        } else if (
          log.includes('success') ||
          log.includes('Success') ||
          log.includes('finished') ||
          log.includes('passed')
        ) {
          color = 'green'
        } else if (log.includes('[info]')) {
          color = '#3B82F6'
        } else if (log.includes('debug')) {
          color = '#6B7280'
        } else if (log.includes('[warn]')) {
          color = '#F59E0B'
        }
      } catch (err) {
        console.log(logs)
        console.log(err)
      }
      return (
        <div key={index} style={{ color, margin: 0 }}>
          {log}
        </div>
      )
    })
  }
  return (
    <div className="flex w-full flex-1 gap-0 rounded-lg">
      <div className="flex h-full flex-col" style={{ minWidth: 0 }}>
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
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col pl-4 transition-all duration-300">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <ScriptEditor
              filePath={currentFile}
              cachedValue={currentFile ? fileCache[currentFile] : undefined}
              onContentLoaded={({ content, original }, { filePath }) => {
                if (!filePath) return
                setFileCache((prev) => ({
                  ...prev,
                  [filePath]: { content, original },
                }))
              }}
              onContentChange={(value, info) => {
                const fileKey = info?.filePath ?? currentFile
                if (!fileKey) return
                setFileCache((prev) => {
                  const existing = prev[fileKey]
                  const original = existing?.original ?? value
                  return {
                    ...prev,
                    [fileKey]: { content: value, original },
                  }
                })
              }}
              onContentSaved={({ content, original }, { filePath }) => {
                if (!filePath) return
                setFileCache((prev) => ({
                  ...prev,
                  [filePath]: { content, original },
                }))
              }}
            />
          </div>
          <Control
            currentFile={currentFile}
            running={running}
            connected={connected}
            setRunning={setRunning}
            run={runPath}
            buildLibs={buildLibs}
          />
          <OutputPanel renderLogs={renderLogs} open={openLog} setOpen={setOpenLog} />
        </div>
      </div>
    </div>
  )
}
