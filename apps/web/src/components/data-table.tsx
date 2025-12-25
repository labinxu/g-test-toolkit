'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TableHeaderContent } from '@/components/table-header-content';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type SortDir = 'asc' | 'desc';

export type GTableRow = React.ReactNode[];

export type ColumnDef<T> = {
  key: string;
  header: React.ReactNode;
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  sticky?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  accessor?: (row: T) => any;
  render?: (row: T, globalIndex: number, pageIndex: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  filterType?: 'text' | 'select';
  filterPlaceholder?: string;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: ColumnDef<T>[];
  getRowKey: (row: T, globalIndex: number) => string;
  page: number;
  pageSize: number;
  containerClassName?: string;
  frameClassName?: string;
  framePadding?: 'md' | 'none';
  headerHeightPx?: number;
  stickyHeader?: boolean;
  headerLightClass?: string;
  headerDarkClass?: string;
  density?: 'compact' | 'normal';
  selection?: {
    enabled: boolean;
    keys: Set<string>;
    onChange: (keys: Set<string>) => void;
    width?: number;
    minWidth?: number;
  };
  sortKey?: string;
  sortDir?: SortDir;
  onSortChange?: (key: string, dir: SortDir) => void;
  compareFns?: Record<string, (a: T, b: T) => number>;
  caption?: React.ReactNode;
  enableFilters?: boolean;
  rowClassName?: (row: T, globalIndex: number) => string | undefined;
  onRowCountChange?: (total: number, filtered: number) => void;
  onRowDoubleClick?: (row: T, globalIndex: number) => void;
};

export function ResizableStickyTable<T>(props: DataTableProps<T>) {
  const {
    rows,
    columns,
    getRowKey,
    page,
    pageSize,
    containerClassName,
    frameClassName,
    framePadding = 'md',
    headerHeightPx,
    stickyHeader = true,
    headerLightClass = 'bg-indigo-50 text-indigo-950',
    headerDarkClass = 'dark:bg-indigo-900 dark:text-indigo-100',
    density = 'normal',
    selection,
    sortKey,
    sortDir = 'desc',
    onSortChange,
    compareFns,
    caption,
    enableFilters = false,
    rowClassName,
    onRowCountChange,
    onRowDoubleClick,
  } = props;

  // Build initial widths
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const c of columns) m[c.key] = c.width ?? 140;
    if (selection?.enabled) m['__sel__'] = selection.width ?? 40;
    return m;
  });
  const minWidths = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of columns) m[c.key] = c.minWidth ?? 80;
    if (selection?.enabled) m['__sel__'] = selection.minWidth ?? 36;
    return m;
  }, [columns, selection?.enabled, selection?.minWidth]);

  const resizingRef = useRef<{
    key: string;
    startX: number;
    startW: number;
  } | null>(null);
  const onResizeDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = colWidths[key] ?? 120;
    resizingRef.current = { key, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      const cur = resizingRef.current;
      if (!cur) return;
      const dx = ev.clientX - cur.startX;
      const next = Math.max(minWidths[key] || 40, Math.round(cur.startW + dx));
      setColWidths((prev) => ({ ...prev, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      resizingRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Sorting
  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    if (sortKey === key) onSortChange(key, sortDir === 'desc' ? 'asc' : 'desc');
    else onSortChange(key, 'desc');
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const cmp = compareFns?.[sortKey];
    if (!cmp) return rows;
    const arr = rows.slice();
    arr.sort((a, b) => (cmp(a, b) || 0) * (sortDir === 'desc' ? -1 : 1));
    return arr;
  }, [rows, sortKey, sortDir, compareFns]);

  // Build select filter options per column (based on all rows)
  const selectFilterOptions = useMemo(() => {
    const m: Record<string, string[]> = {};
    if (!enableFilters) return m;
    for (const col of columns) {
      if (col.filterType === 'select') {
        m[col.key] = [];
      }
    }
    const keys = Object.keys(m);
    if (!keys.length) return m;
    for (const row of rows) {
      for (const col of columns) {
        if (col.filterType !== 'select') continue;
        const key = col.key;
        const raw = col.accessor ? col.accessor(row) : (row as any)[key];
        const val = raw == null ? '' : String(raw);
        const list = m[key];
        if (!list.includes(val)) list.push(val);
      }
    }
    return m;
  }, [rows, columns, enableFilters]);

  // Simple internal filter state (per column, string value)
  const [filters, setFilters] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    if (!enableFilters) return sortedRows;
    const activeKeys = Object.keys(filters).filter((k) => filters[k]);
    if (!activeKeys.length) return sortedRows;
    return sortedRows.filter((row) => {
      for (const col of columns) {
        const fval = filters[col.key];
        if (!fval) continue;
        const raw = col.accessor ? col.accessor(row) : (row as any)[col.key];
        const value = raw == null ? '' : String(raw);
        if (col.filterType === 'text') {
          if (!value.toLowerCase().includes(fval.toLowerCase())) return false;
        } else if (col.filterType === 'select') {
          if (fval !== '__all__' && value !== fval) return false;
        }
      }
      return true;
    });
  }, [sortedRows, columns, filters, enableFilters]);

  useEffect(() => {
    if (onRowCountChange) {
      onRowCountChange(rows.length, filteredRows.length);
    }
  }, [rows.length, filteredRows.length, onRowCountChange]);

  // Paging
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / Math.max(1, pageSize)),
  );
  const safePage = Math.max(1, Math.min(totalPages, page));
  const startIndex = (safePage - 1) * pageSize;
  const paged = filteredRows.slice(startIndex, startIndex + pageSize);

  // Selection helpers (per-page select all)
  const isPageAllSelected = useMemo(() => {
    if (!selection?.enabled) return false;
    if (paged.length === 0) return false;
    const set = selection.keys;
    for (let i = 0; i < paged.length; i++) {
      const row = paged[i];
      const key = getRowKey(row, startIndex + i);
      if (!set.has(key)) return false;
    }
    return true;
  }, [selection?.enabled, selection?.keys, paged, getRowKey, startIndex]);

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (!selection?.enabled) return;
    const next = new Set(selection.keys);
    for (let i = 0; i < paged.length; i++) {
      const row = paged[i];
      const key = getRowKey(row, startIndex + i);
      if (checked) next.add(key);
      else next.delete(key);
    }
    selection.onChange(next);
  };

  // Header classes（让每个表头单元格自己 sticky）
  const stickyHeaderCls = stickyHeader
    ? `sticky top-0 ${headerLightClass} ${headerDarkClass}`
    : '';
  const isCompact = density === 'compact';
  const headerHeight =
    typeof headerHeightPx === 'number'
      ? headerHeightPx
      : isCompact
        ? 32
        : undefined;

  // Compute left offsets for left-sticky columns (account for selection)
  const selWidth = selection?.enabled ? colWidths['__sel__'] || 0 : 0;
  const leftOffsets: Record<string, number> = {};
  {
    let acc = selWidth;
    for (const c of columns) {
      if (c.sticky === 'left') {
        leftOffsets[c.key] = acc;
        acc += colWidths[c.key] || 0;
      }
    }
  }

  return (
    <div
      className={cn(
        'relative min-h-0 h-full w-full overflow-hidden border border-border',
        framePadding === 'none' ? 'p-0' : 'p-2',
        frameClassName ?? 'rounded',
      )}
    >
      <Table
        className="table-fixed"
        containerClassName={
          containerClassName || 'overflow-x-auto overflow-y-auto'
        }
      >
        <TableHeader>
          <TableRow className="divide-x divide-border">
            {selection?.enabled && (
              <TableHead
                className={cn(
                  // ensure sticky on both axes and solid background
                  'sticky top-0 left-0 z-[60] border-r border-border',
                  stickyHeaderCls,
                )}
                style={{
                  width: colWidths['__sel__'],
                  minWidth: colWidths['__sel__'],
                  height: headerHeight,
                }}
              >
                <div className="flex">
                  <Checkbox
                    checked={isPageAllSelected}
                    onCheckedChange={(v) => toggleSelectAllOnPage(!!v)}
                  />
                </div>
              </TableHead>
            )}
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const sortable =
                !!col.sortable && !!onSortChange && !!compareFns?.[col.key];
              const alignCls =
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';
              const stickySide =
                col.sticky === 'right'
                  ? 'sticky right-0 z-30 border-l border-border before:pointer-events-none before:absolute before:top-0 before:left-0 before:h-full before:w-2 before:content-["\"] before:bg-gradient-to-r before:from-black/10 before:to-transparent dark:before:from-white/10'
                  : col.sticky === 'left'
                    ? 'sticky z-50 border-r border-border after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-2 after:content-["\"] after:bg-gradient-to-l after:from-black/10 after:to-transparent dark:after:from-white/10'
                    : '';
              const leftStyle =
                col.sticky === 'left'
                  ? { left: `${leftOffsets[col.key] || 0}px` }
                  : undefined;
              return (
                <TableHead
                  key={col.key}
                  className={cn(
                    'relative align-middle',
                    stickyHeaderCls,
                    alignCls,
                    stickySide,
                    col.headerClassName,
                    sortable && 'cursor-pointer select-none',
                  )}
                  style={{
                    width: colWidths[col.key],
                    minWidth: colWidths[col.key],
                    height: headerHeight,
                    ...(leftStyle || {}),
                  }}
                >
                  <TableHeaderContent
                    label={col.header}
                    onClick={sortable ? () => toggleSort(col.key) : undefined}
                    right={
                      <>
                        {isSorted && sortable ? (
                          sortDir === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5" />
                          )
                        ) : null}
                        {enableFilters && col.filterType ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  'text-muted-foreground hover:border-border hover:bg-muted inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-[11px]',
                                  filters[col.key] &&
                                    'border-primary/50 bg-primary/5 text-primary',
                                )}
                                aria-label="列过滤"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SlidersHorizontal className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-52 p-2"
                              align="end"
                              sideOffset={4}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {col.filterType === 'text' && (
                                <div className="space-y-1">
                                  <div className="text-muted-foreground text-[11px]">
                                    筛选 {col.header}
                                  </div>
                                  <Input
                                    className="border-border bg-background h-7 w-full rounded border px-1 text-xs"
                                    placeholder={
                                      col.filterPlaceholder || '输入关键词'
                                    }
                                    value={filters[col.key] || ''}
                                    onChange={(e) =>
                                      setFilters((prev) => ({
                                        ...prev,
                                        [col.key]: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              )}
                              {col.filterType === 'select' && (
                                <div className="space-y-1">
                                  <div className="text-muted-foreground text-[11px]">
                                    选择 {col.header}
                                  </div>
                                  <Select
                                    value={filters[col.key] || '__all__'}
                                    onValueChange={(v) =>
                                      setFilters((prev) => ({
                                        ...prev,
                                        [col.key]: v === '__all__' ? '' : v,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-full px-2 text-xs">
                                      <SelectValue placeholder="全部" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__all__">
                                        全部
                                      </SelectItem>
                                      {(selectFilterOptions[col.key] || []).map(
                                        (opt) => (
                                          <SelectItem
                                            key={opt || '-'}
                                            value={opt}
                                          >
                                            {opt || '-'}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </>
                    }
                  />
                  <span
                    className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
                    onMouseDown={(e) => onResizeDown(col.key, e)}
                  />
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody id="table_body">
          {(() => {
            const usedKeys = new Set<string>();
            return paged.map((row, i) => {
              const globalIndex = startIndex + i;
              const baseKey = String(getRowKey(row, globalIndex) ?? '');
              let rowKey = baseKey || `row-${globalIndex}`;
              if (usedKeys.has(rowKey)) rowKey = `${rowKey}#${globalIndex}`;
              usedKeys.add(rowKey);
              const extraRowCls = rowClassName
                ? rowClassName(row, globalIndex)
                : undefined;
              return (
                <TableRow
                  key={rowKey}
                  className={cn('divide-x divide-border', extraRowCls)}
                  onDoubleClick={
                    onRowDoubleClick
                      ? () => {
                          onRowDoubleClick(row, globalIndex);
                        }
                      : undefined
                  }
                >
                  {selection?.enabled && (
                    <TableCell
                      className={cn(
                        'sticky left-0 z-40 border-r border-border bg-white after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-2 after:bg-gradient-to-l after:from-black/10 after:to-transparent after:content-[""] dark:bg-neutral-900 dark:after:from-white/10',
                        isCompact ? 'py-1' : '',
                      )}
                      style={{
                        width: colWidths['__sel__'],
                        minWidth: colWidths['__sel__'],
                      }}
                    >
                      <Checkbox
                        checked={selection.keys.has(
                          getRowKey(row, globalIndex),
                        )}
                        onCheckedChange={(v) => {
                          const next = new Set(selection.keys);
                          const k = getRowKey(row, globalIndex);
                          if (v) next.add(k);
                          else next.delete(k);
                          selection.onChange(next);
                        }}
                      />
                    </TableCell>
                  )}
                  {columns.map((col, ci) => {
                    const stickySide =
                      col.sticky === 'right'
                        ? 'sticky right-0 z-10 bg-white dark:bg-neutral-900 border-l border-border before:pointer-events-none before:absolute before:top-0 before:left-0 before:h-full before:w-2 before:content-["\"] before:bg-gradient-to-r before:from-black/10 before:to-transparent dark:before:from-white/10'
                        : col.sticky === 'left'
                          ? 'sticky z-20 bg-white dark:bg-neutral-900 border-r border-border after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-2 after:content-["\"] after:bg-gradient-to-l after:from-black/10 after:to-transparent dark:after:from-white/10'
                          : '';
                    const alignCls =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left';
                    const leftStyle =
                      col.sticky === 'left'
                        ? { left: `${leftOffsets[col.key] || 0}px` }
                        : undefined;
                    return (
                      <TableCell
                        key={`${col.key}-${ci}`}
                        className={cn(
                          'truncate',
                          stickySide,
                          alignCls,
                          col.className,
                          isCompact ? 'py-1' : '',
                        )}
                        style={{
                          width: colWidths[col.key],
                          minWidth: colWidths[col.key],
                          ...(leftStyle || {}),
                        }}
                      >
                        {col.render
                          ? col.render(row, globalIndex, i)
                          : String(
                              col.accessor
                                ? (col.accessor(row) ?? '')
                                : ((row as any)[col.key] ?? ''),
                            )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            });
          })()}
        </TableBody>
        {caption ? (
          <TableCaption className="justify-center">{caption}</TableCaption>
        ) : null}
      </Table>
    </div>
  );
}

export default ResizableStickyTable;

type GTableProps = {
  caption?: string;
  headers: React.ReactNode[];
  rows: GTableRow[];
  containerClassName?: string;
  showFooter?: boolean;
  onSelectedRow?: (rowIndex: number) => void;
  onRowDoubleClick?: (rowIndex: number) => void;
  highlightRowIndex?: number | null;
  stickyFirstColumn?: boolean;
  stickyLastColumn?: boolean;
  stickyLastColumnWidthPx?: number;
};

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
  stickyLastColumn = false,
  stickyLastColumnWidthPx,
}: GTableProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    if (selectedRow === null) return;
    if (!onSelectedRow) return;
    if (selectedRow < 0 || selectedRow >= rows.length) return;
    onSelectedRow(selectedRow);
  }, [selectedRow, rows, onSelectedRow]);

  return (
    <Table
      className="w-full border border-border text-xs"
      containerClassName={containerClassName}
    >
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {headers.map((v, index) => {
            const isFirst = index === 0;
            const isLast = index === headers.length - 1;
            const stickyLastStyle =
              stickyLastColumn && isLast && stickyLastColumnWidthPx
                ? {
                    width: stickyLastColumnWidthPx,
                    minWidth: stickyLastColumnWidthPx,
                  }
                : undefined;
            return (
              <TableHead
                key={`head-${index}`}
                className={cn(
                  'sticky top-0 z-20 border-r border-border last:border-r-0 bg-muted/70 px-2 py-1.5 text-left text-xs font-medium',
                  stickyFirstColumn &&
                    isFirst &&
                    'left-0 z-30 after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-2 after:bg-gradient-to-l after:from-black/10 after:to-transparent after:content-[""] dark:after:from-white/10',
                  stickyLastColumn &&
                    isLast &&
                    'right-0 z-30 border-l border-border before:pointer-events-none before:absolute before:top-0 before:left-0 before:h-full before:w-2 before:bg-gradient-to-r before:from-black/10 before:to-transparent before:content-[""] dark:before:from-white/10',
                )}
                style={stickyLastStyle}
              >
                {typeof v === 'string' || typeof v === 'number' ? (
                  <div className="w-full truncate">{v}</div>
                ) : (
                  v
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => {
          const rowSelected = selectedRow === rowIndex;
          const rowHighlighted = highlightRowIndex === rowIndex;

          return (
            <TableRow
              key={`row-${rowIndex}`}
              className={cn(
                'cursor-pointer transition-colors',
                rowSelected && 'bg-primary/5 dark:bg-primary/15',
                rowHighlighted &&
                  'bg-primary/10 dark:bg-primary/25 text-emerald-700 dark:text-emerald-400',
              )}
              onClick={() => {
                setSelectedRow(rowIndex);
              }}
              onDoubleClick={() => {
                if (onRowDoubleClick) {
                  onRowDoubleClick(rowIndex);
                }
              }}
            >
              {row.map((item, i) => {
                const isFirst = i === 0;
                const isLast = i === row.length - 1;
                const stickyLastStyle =
                  stickyLastColumn && isLast && stickyLastColumnWidthPx
                    ? {
                        width: stickyLastColumnWidthPx,
                        minWidth: stickyLastColumnWidthPx,
                      }
                    : undefined;
                return (
                  <TableCell
                    key={`item-${rowIndex}-${i}`}
                    className={cn(
                      'max-w-[220px] truncate whitespace-nowrap border-r border-border px-2 py-1.5 align-middle last:border-r-0',
                      stickyFirstColumn &&
                        isFirst &&
                        cn(
                          'sticky left-0 z-10 border-r border-border',
                          'bg-white dark:bg-neutral-900',
                          'after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-2 after:bg-gradient-to-l after:from-black/10 after:to-transparent after:content-[""] dark:after:from-white/10',
                        ),
                      stickyLastColumn &&
                        isLast &&
                        cn(
                          'sticky right-0 z-10 border-l border-border',
                          'bg-white dark:bg-neutral-900',
                          'before:pointer-events-none before:absolute before:top-0 before:left-0 before:h-full before:w-2 before:bg-gradient-to-r before:from-black/10 before:to-transparent before:content-[""] dark:before:from-white/10',
                        ),
                    )}
                    style={stickyLastStyle}
                  >
                    {item}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
      {showFooter ? (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={Math.max(1, headers.length - 1)}>
              Total
            </TableCell>
            <TableCell className="text-right">{rows.length}</TableCell>
          </TableRow>
        </TableFooter>
      ) : null}
    </Table>
  );
}
