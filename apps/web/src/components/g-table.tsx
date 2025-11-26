'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type GTableRow = ReactNode[]

type GTableProps = {
  caption?: string
  headers: ReactNode[]
  rows: GTableRow[]
  onSelectedRow?: (rowIndex: number) => void
  onRowDoubleClick?: (rowIndex: number) => void
  highlightRowIndex?: number | null
}

export function GTable({
  caption,
  headers,
  rows,
  onSelectedRow,
  highlightRowIndex,
  onRowDoubleClick,
}: GTableProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null)

  useEffect(() => {
    if (selectedRow === null) return
    if (!onSelectedRow) return
    if (selectedRow < 0 || selectedRow >= rows.length) return
    onSelectedRow(selectedRow)
  }, [selectedRow, rows, onSelectedRow])

  return (
    <Table>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {headers.map((v, index) => (
            <TableHead key={`head-${index}`}>{v}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow
            key={`row-${rowIndex}`}
            className={cn(
              'cursor-pointer transition-colors',
              selectedRow === rowIndex && 'bg-primary/5 dark:bg-primary/15',
              highlightRowIndex === rowIndex &&
                'bg-primary/10 dark:bg-primary/25 text-emerald-700 dark:text-emerald-400'
            )}
            onClick={() => {
              setSelectedRow(rowIndex)
            }}
            onDoubleClick={() => {
              if (onRowDoubleClick) {
                onRowDoubleClick(rowIndex)
              }
            }}
          >
            {row.map((item, i) => (
              <TableCell key={`item-${rowIndex}-${i}`}>{item}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={Math.max(1, headers.length - 1)}>Total</TableCell>
          <TableCell className="text-right">{rows.length}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
