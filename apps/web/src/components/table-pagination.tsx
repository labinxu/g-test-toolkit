import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export type TablePaginationProps = {
  page: number
  totalPages: number
  totalRows?: number
  pageSize?: number
  pageSizeMin?: number
  pageSizeMax?: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  className?: string
}

export function TablePagination({
  page,
  totalPages,
  totalRows,
  pageSize,
  pageSizeMin = 10,
  pageSizeMax = 500,
  onPageChange,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1)
  const safePage = Math.max(1, Math.min(safeTotalPages, page || 1))
  const canPrev = safePage > 1
  const canNext = safePage < safeTotalPages

  const [pageInput, setPageInput] = useState<string>(() => String(safePage))

  // 同步外部传入的页码到输入框
  useEffect(() => {
    setPageInput(String(safePage))
  }, [safePage])

  const handlePageChange = (next: number) => {
    const clamped = Math.max(1, Math.min(safeTotalPages, next))
    if (clamped !== safePage) onPageChange(clamped)
  }

  const handlePageSizeChange = (value: number) => {
    if (!onPageSizeChange) return
    const v = Number.isFinite(value) ? value : pageSizeMin
    const clamped = Math.max(pageSizeMin, Math.min(pageSizeMax, v))
    onPageSizeChange(clamped)
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 text-xs text-muted-foreground',
        className
      )}
    >
      <span>
        共 {totalRows != null ? totalRows : '—'} 条
        {safeTotalPages > 1 ? `，第 ${safePage}/${safeTotalPages} 页` : ''}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <>
            <span>每页</span>
            <Input
              type="number"
              className="h-7 w-[72px]"
              min={pageSizeMin}
              max={pageSizeMax}
              value={pageSize ?? pageSizeMin}
              onChange={(e) => {
                const v = Number(e.target.value) || pageSizeMin
                handlePageSizeChange(v)
                // 回到第一页由父组件决定（通常会 setPage(1)）
              }}
            />
          </>
        )}
        <div className="flex items-center gap-1">
          <span>第</span>
          <Input
            type="number"
            className="h-7 w-[60px]"
            min={1}
            max={safeTotalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => {
              const v = Number(pageInput) || safePage
              handlePageChange(v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = Number(pageInput) || safePage
                handlePageChange(v)
              }
            }}
          />
          <span>页</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="第一页"
            aria-label="第一页"
            onClick={() => handlePageChange(1)}
            disabled={!canPrev}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="上一页"
            aria-label="上一页"
            onClick={() => handlePageChange(safePage - 1)}
            disabled={!canPrev}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="下一页"
            aria-label="下一页"
            onClick={() => handlePageChange(safePage + 1)}
            disabled={!canNext}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="最后一页"
            aria-label="最后一页"
            onClick={() => handlePageChange(safeTotalPages)}
            disabled={!canNext}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default TablePagination
