'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { RedisControl } from '@/components/redis-control'
import { Button } from '@/components/ui/button'

export default function RegisterAccountPage() {
  const [key, setKey] = useState('')

  return (
    <div className="flex w-full flex-1 flex-col gap-2 p-4">
      {/* 第一行：输入框 */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Input email or phone"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="h-9 w-[420px]"
        />
        <Button>Registert</Button>
      </div>

      {/* 第二行：Redis 控件 */}
      <div>
        <RedisControl
          defaultKey={key}
          resultsCollapsible
          resultsTitle="Results"
          initialResultsOpen
        />
      </div>
    </div>
  )
}
