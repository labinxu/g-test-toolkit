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
  containerClassName?: string
  showFooter?: boolean
  onSelectedRow?: (rowIndex: number) => void
  onRowDoubleClick?: (rowIndex: number) => void
  highlightRowIndex?: number | null
  stickyFirstColumn?: boolean
}

export function GTable({
  caption,
  headers,
  rows,
  containerClassName,
  showFooter = true,
  onSelectedRow,
  highlightRowIndex,
  onRowDoubleClick,
  stickyFirstColumn = false,
}: GTableProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null)

  useEffect(() => {
    if (selectedRow === null) return
    if (!onSelectedRow) return
    if (selectedRow < 0 || selectedRow >= rows.length) return
    onSelectedRow(selectedRow)
  }, [selectedRow, rows, onSelectedRow])

  return (
    <Table
      className="w-full border border-border text-xs"
      containerClassName={containerClassName}
    >
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {headers.map((v, index) => (
            <TableHead
              key={`head-${index}`}
              className={cn(
                'sticky top-0 z-20 border-r border-border last:border-r-0 bg-muted/70 px-2 py-1.5 text-xs font-medium',
                stickyFirstColumn && index === 0 && 'left-0 z-30'
              )}
            >
              <div className="truncate">{v}</div>
            </TableHead>
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
              <TableCell
                key={`item-${rowIndex}-${i}`}
                className={cn(
                  'max-w-[220px] truncate whitespace-nowrap border-r border-border px-2 py-1.5 align-middle last:border-r-0',
                  stickyFirstColumn && i === 0 && 'sticky left-0 z-10 bg-background'
                )}
              >
                {item}
              </TableCell>
            ))}
        </TableRow>
      ))}
      </TableBody>
      {showFooter ? (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={Math.max(1, headers.length - 1)}>Total</TableCell>
            <TableCell className="text-right">{rows.length}</TableCell>
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  )
}
