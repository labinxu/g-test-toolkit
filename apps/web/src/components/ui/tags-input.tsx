'use client'
import React, { useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function TagsInput({
  value,
  onChange,
  placeholder,
  suggestions,
  className,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  className?: string
}) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const list = useMemo(() => Array.from(new Set(value.map((s) => s.trim()).filter(Boolean))), [value])
  const filteredSuggs = useMemo(() => {
    const base = (suggestions || []).filter(Boolean)
    const lower = input.toLowerCase()
    return base.filter((s) => s.toLowerCase().includes(lower) && !list.includes(s))
  }, [suggestions, input, list])
  const add = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    if (list.includes(t)) return
    onChange([...list, t])
    setInput('')
  }
  const remove = (tag: string) => {
    onChange(list.filter((x) => x !== tag))
  }
  return (
    <div ref={containerRef} className={cn('rounded border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1', className)}>
      <div className="flex flex-wrap gap-1">
        {list.map((t) => (
          <Badge key={t} variant="secondary" className="px-2 py-0.5">
            <span>{t}</span>
            <button
              type="button"
              className="ml-1 opacity-70 hover:opacity-100"
              onClick={() => remove(t)}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </Badge>
        ))}
        <input
          className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 py-1"
          value={input}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(input)
            } else if (e.key === 'Backspace' && !input && list.length) {
              remove(list[list.length - 1])
            }
          }}
        />
      </div>
      {open && filteredSuggs.length > 0 && (
        <div className="mt-1 max-h-40 overflow-auto rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm shadow">
          {filteredSuggs.map((s) => (
            <div
              key={s}
              className="cursor-pointer px-2 py-1 hover:bg-gray-50 dark:hover:bg-neutral-800"
              onMouseDown={(e) => {
                e.preventDefault()
                add(s)
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

