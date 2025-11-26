'use client'

import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { type ColumnDef } from '@/components/data-table'

export type Review = {
  id?: string
  userName?: string
  date?: string
  score?: number
  title?: string
  text?: string
  version?: string
  thumbsUp?: number
  store?: string
  lang?: string
  region?: string
  packageId?: string
}

export const parseVersion = (s?: string): number[] => {
  if (!s) return [-1]
  const parts = String(s)
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((x) => parseInt(x, 10))
  return parts.length ? parts : [-1]
}

export function buildCompareFns() {
  const cmp: Record<string, (a: Review, b: Review) => number> = {
    score: (a, b) => Number(a.score ?? 0) - Number(b.score ?? 0),
    thumbsUp: (a, b) => Number(a.thumbsUp ?? 0) - Number(b.thumbsUp ?? 0),
    date: (a, b) => Date.parse(a.date || '0') - Date.parse(b.date || '0'),
    version: (a, b) => {
      const va = parseVersion(a.version)
      const vb = parseVersion(b.version)
      const n = Math.max(va.length, vb.length)
      for (let i = 0; i < n; i++) {
        const ai = va[i] ?? 0
        const bi = vb[i] ?? 0
        if (ai !== bi) return ai - bi
      }
      return 0
    },
  }
  return cmp
}

export function buildColumns(params: { onDeleteRow: (row: Review) => void }): ColumnDef<Review>[] {
  const { onDeleteRow } = params
  return [
    {
      key: 'index',
      header: '#',
      width: 60,
      minWidth: 50,
      sortable: false,
      sticky: 'left',
      render: (_r, gi) => gi + 1,
    },
    {
      key: 'score',
      header: 'Score',
      width: 80,
      minWidth: 60,
      sortable: true,
      accessor: (r) => r.score,
    },
    {
      key: 'date',
      header: 'Date',
      width: 180,
      minWidth: 140,
      sortable: true,
      accessor: (r) => r.date,
    },
    {
      key: 'userName',
      header: 'User',
      width: 150,
      minWidth: 100,
      sortable: false,
      accessor: (r) => r.userName,
    },
    {
      key: 'version',
      header: 'Version',
      width: 100,
      minWidth: 80,
      sortable: true,
      accessor: (r) => r.version,
    },
    {
      key: 'thumbsUp',
      header: 'ThumbsUp',
      width: 120,
      minWidth: 90,
      sortable: true,
      accessor: (r) => r.thumbsUp,
      align: 'right',
    },
    {
      key: 'title',
      header: 'Title',
      width: 280,
      minWidth: 160,
      sortable: false,
      render: (r) => <span title={r.title}>{r.title}</span>,
    },
    {
      key: 'text',
      header: 'Text',
      width: 560,
      minWidth: 240,
      sortable: false,
      render: (r) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="truncate">{r.text ?? ''}</div>
          </TooltipTrigger>
          <TooltipContent className="max-h-[300px] w-[420px] overflow-auto p-2 break-words whitespace-pre-wrap">
            {r.text ?? ''}
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: 'delete',
      header: 'Action',
      width: 50,
      minWidth: 50,
      sticky: 'right',
      sortable: false,
      render: (r) => (
        <Button
          size="icon"
          variant="ghost"
          title="Delete row"
          aria-label="Delete row"
          className={'h-8 w-8 rounded-full text-red-200'}
          onClick={() => onDeleteRow(r)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]
}
