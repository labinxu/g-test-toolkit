'use client'

import { Button } from '@/components/ui/button'

type LinkedScenario = {
  id: number
  code: string
  title: string
  platform: string
}

type Props = {
  linkedScenario: LinkedScenario | null
  onViewScenario: () => void
}

export function LinkedScenarioBanner({ linkedScenario, onViewScenario }: Props) {
  if (!linkedScenario) return null
  return (
    <div className="mb-1 flex items-center justify-between rounded-md border bg-muted/40 px-2 py-1 text-[11px]">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">
          映射用例：[{linkedScenario.platform}] {linkedScenario.code}（ID: {linkedScenario.id}）
        </span>
        <span className="text-muted-foreground truncate">{linkedScenario.title}</span>
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="ml-2 h-6 px-2 text-[11px]"
        onClick={onViewScenario}
      >
        在「用户场景」中查看
      </Button>
    </div>
  )
}
