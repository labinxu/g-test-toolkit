'use client';
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
}: {
  caption?: string;
  headers: string[];
  dataRow: string[][];
  onSelectedRow: (row: string[]) => void;
}) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    if (selectedRow === null) return;
    onSelectedRow && onSelectedRow(dataRow[selectedRow]);
  }, [selectedRow]);

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
          <TableHead>Action</TableHead>
          <TableHead>Preview</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dataRow.map((row: string[], rowIndex: number) => (
          <TableRow
            key={`row-${rowIndex}`}
            className={cn("cursor-pointer", selectedRow === rowIndex ? 'bg-blue-300' : 'bg-blue-50')}
            onClick={() => {
              setSelectedRow(rowIndex);
            }}
            style={{ cursor: 'pointer' }}
          >
            {row.map((item: string, i: number) => (
              <TableCell key={`item-${rowIndex}-${i}`}>{item}</TableCell>
            ))}
             <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="size-8 cursor-pointer" tabIndex={-1}>
                      {row[2] === 'Free' ? <LockKeyholeOpen /> : <LockKeyhole />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {row[2] === 'Free' ? 'Device Available' : 'Device Unavailable'}
                  </TooltipContent>
                </Tooltip>
              </TableCell>

            <TableCell>
              <DeviceHoverCard deviceId={row[0]} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>Total</TableCell>
          <TableCell className="text-right">{dataRow.length}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
      </TooltipProvider>
  );
}
