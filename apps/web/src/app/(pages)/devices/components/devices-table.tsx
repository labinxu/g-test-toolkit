'use client'

import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type DevicesTableColumn = {
  title: ReactNode
  className?: string
}

export type DevicesTableRow = {
  key: string
  cells: ReactNode[]
  className?: string
  onClick?: () => void
}

export function DevicesTable({
  columns,
  rows,
  loading = false,
  emptyText = 'No data',
  loadingText = 'Loading...',
}: {
  columns: DevicesTableColumn[]
  rows: DevicesTableRow[]
  loading?: boolean
  emptyText?: string
  loadingText?: string
}) {
  const colSpan = Math.max(1, columns.length)

  return (
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          {columns.map((col, idx) => (
            <TableHead key={idx} className={col.className}>
              {col.title}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan}>{loadingText}</TableCell>
          </TableRow>
        ) : null}
        {!loading && rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan}>{emptyText}</TableCell>
          </TableRow>
        ) : null}
        {rows.map((row) => (
          <TableRow
            key={row.key}
            className={cn(
              'odd:bg-muted/20 even:bg-muted/40 transition-colors',
              row.className,
              row.onClick && 'cursor-pointer',
            )}
            onClick={row.onClick}
          >
            {row.cells.map((cell, idx) => (
              <TableCell key={`${row.key}-cell-${idx}`} className={columns[idx]?.className}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
