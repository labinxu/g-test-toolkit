import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import TablePagination, { type TablePaginationProps } from '@/components/table-pagination'

export type TableToolbarProps = TablePaginationProps & {
  rightActions?: ReactNode
  wrapperClassName?: string
}

export function TableToolbar({
  rightActions,
  wrapperClassName,
  className,
  ...paginationProps
}: TableToolbarProps) {
  return (
    <div
      className={cn(
        'mb-2 flex items-center justify-between gap-2',
        wrapperClassName
      )}
    >
      <TablePagination {...paginationProps} className={className} />
      {rightActions ? (
        <div className="flex items-center gap-2">{rightActions}</div>
      ) : null}
    </div>
  )
}

export default TableToolbar

