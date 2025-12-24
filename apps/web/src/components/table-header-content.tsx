'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  label: ReactNode
  right?: ReactNode
  onClick?: () => void
  className?: string
  labelClassName?: string
}

export function TableHeaderContent({
  label,
  right,
  onClick,
  className,
  labelClassName,
}: Props) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-between gap-2',
        onClick && 'cursor-pointer select-none',
        className
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'min-w-0 flex-1 truncate text-left leading-none',
          labelClassName
        )}
      >
        {label}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null}
    </div>
  )
}
