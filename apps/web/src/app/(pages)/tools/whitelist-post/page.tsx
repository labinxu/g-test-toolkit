'use client'
import { useState, useCallback, useMemo } from 'react'
import { javascript } from '@codemirror/lang-javascript'
import { Label } from '@/components/ui/label'
import { OptionsSelect, OptionsSelectItem } from '@/components/select/options-select'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { useTheme } from 'next-themes'
import CodeMirror from '@uiw/react-codemirror'
import { ListX, ListPlus, ListCheck } from 'lucide-react'
import { TooltipTrigger, TooltipContent, Tooltip } from '@/components/ui/tooltip'
type EnvKey = 'qa1x' | 'qa4'
type Env = { label: string; apiKey: string; api: string }

const ENVIRONMENTS: Record<EnvKey, Env> = {
  qa1x: {
    label: 'QA1X',
    apiKey: 'hwfPHZbB4d4dPgRLy',
    api: ' https://next-backend-notif.qa1.ue1.oke.gettr-qa.com/api/v1/def-notif-whitelist',
  },
  qa4: {
    label: 'QA4',
    apiKey: 'hwfPHZbB4d4dPgRLyqa4',
    api: 'https://next-backend-notif.qa4.ue1.oke.gettr-qa.com/api/v1/def-notif-whitelist',
  },
}

const ENVIRONMENT_ITEMS: OptionsSelectItem<EnvKey>[] = (
  Object.entries(ENVIRONMENTS) as [EnvKey, Env][]
).map(([value, env]) => ({
  value,
  label: env.label,
}))

export default function WhitelistPostPage() {
  const [qaEnv, setQaEnv] = useState<Env>(ENVIRONMENTS.qa1x)
  const [payload, setPayload] = useState('{\n\t"user_ids":["post_notify_1"]\n}')
  const [whitelist, setWhitelist] = useState('')
  const { theme } = useTheme()
  const handleViewWhitelist = useCallback(async () => {
    const response = await fetch(qaEnv.api, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': qaEnv.apiKey,
      },
    })
    const wl = await response.json()
    setWhitelist(JSON.stringify(wl))
  }, [qaEnv.api, qaEnv.apiKey])
  const handleAddWhitelist = useCallback(async () => {
    if (payload === '') {
      return
    }
    await fetch(qaEnv.api, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': qaEnv.apiKey,
      },
      body: payload,
    })
    await handleViewWhitelist()
  }, [payload, qaEnv.api, qaEnv.apiKey])
  const handleDelete = useCallback(async () => {
    if (payload === '') {
      return
    }
    await fetch(qaEnv.api, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': qaEnv.apiKey,
      },
      body: payload,
    })
    await handleViewWhitelist()
  }, [payload, qaEnv.api, qaEnv.apiKey])
  const handlePayloadChange = useCallback((value: string) => {
    setPayload(value)
  }, [])

  const codeMirrorExtensions = useMemo(() => [javascript({ jsx: true, typescript: true })], [])

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-2 overflow-y-auto rounded-lg border-2 p-6 shadow-lg">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Whitelist post</h1>
        <p className="text-muted-foreground text-sm">
          Add/Remove whitelist for push post notification
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="fast-user-db-environment" className="text-sm font-medium">
          Environment
        </Label>

        <OptionsSelect
          id="environment"
          defaultValue="qa1x"
          items={ENVIRONMENT_ITEMS}
          onSelect={({ value }) => {
            setQaEnv(ENVIRONMENTS[value])
          }}
        />
        <div className="w-full overflow-hidden rounded-md border">
          <CodeMirror
            value={payload}
            height="380px"
            minHeight="220px"
            maxHeight="300px"
            extensions={codeMirrorExtensions}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              bracketMatching: true,
              autocompletion: true,
            }}
            onChange={(value) => handlePayloadChange(value)}
            theme={theme === 'dark' ? 'dark' : 'light'}
            className="w-full text-sm"
          />
        </div>
        <ButtonGroup className="flex w-full items-end justify-end pr-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleViewWhitelist}>
                <ListCheck />
              </Button>
            </TooltipTrigger>
            <TooltipContent>view list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleAddWhitelist}>
                <ListPlus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleDelete}>
                <ListX />
              </Button>
            </TooltipTrigger>
            <TooltipContent>remove list</TooltipContent>
          </Tooltip>
        </ButtonGroup>
        <div className="w-full overflow-hidden rounded-md border">
          <CodeMirror
            readOnly={true}
            value={whitelist}
            height="240px"
            minHeight="240px"
            maxHeight="300px"
            extensions={codeMirrorExtensions}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              bracketMatching: true,
              autocompletion: true,
            }}
            theme={theme === 'dark' ? 'dark' : 'light'}
            className="w-full text-sm"
          />
        </div>
      </div>
    </div>
  )
}
