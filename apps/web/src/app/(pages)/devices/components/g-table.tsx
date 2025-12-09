'use client';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
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
import { DeviceHoverCard } from './device-hover-card';
import { Button } from '@/components/ui/button';
import { LockKeyholeOpen, LockKeyhole } from 'lucide-react';
import { TooltipProvider,Tooltip,TooltipContent,TooltipTrigger } from '@/components/ui/tooltip';
export function GTable({
  caption,
  headers,
  dataRow,
  onSelectedRow,
  actionHeader,
  renderAction,
}: {
  caption?: string;
  headers: string[];
  dataRow: string[][];
  onSelectedRow: (row: string[]) => void;
  actionHeader?: ReactNode;
  renderAction?: (row: string[], rowIndex: number) => ReactNode;
}) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    if (selectedRow === null) return;
    onSelectedRow && onSelectedRow(dataRow[selectedRow]);
  }, [selectedRow, dataRow, onSelectedRow]);

  const extraColumns = 2 + (renderAction ? 1 : 0);
  const totalColumns = headers.length + extraColumns;

  return (
      <TooltipProvider>
    <Table>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {headers.map((v: string, index: number) => (
            <TableHead key={`head-${index}`}>{v}</TableHead>
          ))}
          <TableHead>Status</TableHead>
          <TableHead>Preview</TableHead>
          {renderAction ? <TableHead>{actionHeader ?? 'Action'}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {dataRow.map((row: string[], rowIndex: number) => (
          <TableRow
            key={`row-${rowIndex}`}
            className={cn(
              'cursor-pointer odd:bg-muted/20 even:bg-muted/40 transition-colors',
              selectedRow === rowIndex && 'bg-primary/10 outline outline-2 outline-primary/60'
            )}
            onClick={() => {
              setSelectedRow(rowIndex);
            }}
            style={{ cursor: 'pointer' }}
          >
            {headers.map((_, i: number) => (
              <TableCell key={`item-${rowIndex}-${i}`}>{row[i] ?? ''}</TableCell>
            ))}
            <TableCell>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="size-8 cursor-pointer"
                    tabIndex={-1}
                  >
                    {(row[2] ?? 'Free') === 'Free' ? <LockKeyholeOpen /> : <LockKeyhole />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {(row[2] ?? 'Free') === 'Free'
                    ? 'Device Available'
                    : 'Device Unavailable'}
                </TooltipContent>
              </Tooltip>
            </TableCell>

            <TableCell>
              <DeviceHoverCard deviceId={row[0]} />
            </TableCell>
            {renderAction ? (
              <TableCell>{renderAction(row, rowIndex)}</TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={Math.max(1, totalColumns - 1)}>Total</TableCell>
          <TableCell className="text-right">{dataRow.length}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
      </TooltipProvider>
  );
}
