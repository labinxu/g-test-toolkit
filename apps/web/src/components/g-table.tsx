'use client';
import { useEffect, useState } from 'react';
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

export function GTable({
  caption,
  headers,
  dataRow,
  onSelectedRow,
}: {
  caption?: string;
  headers: string[];
  dataRow: string[][];
  onSelectedRow:(row:string[])=>void;
}) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  useEffect(() => {
    if(selectedRow===null)return
    onSelectedRow&&onSelectedRow(dataRow[selectedRow]);
  }, [selectedRow]);

  return (
    <Table>
      {caption?<TableCaption>{caption}</TableCaption>:null}
      <TableHeader>
        <TableRow>
          {headers.map((v: string, index: number) => (
            <TableHead key={`head-${index}`}>{v}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {dataRow.map((row: string[], rowIndex: number) => (
          <TableRow
            key={`row-${rowIndex}`}
            className={selectedRow === rowIndex ? 'bg-blue-100' : ''}
            onClick={() =>{ setSelectedRow(rowIndex);}}
            style={{ cursor: 'pointer' }}
          >
            {row.map((item: string, i: number) => (
              <TableCell key={`item-${rowIndex}-${i}`}>{item}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={1}>Total</TableCell>
          <TableCell className="text-right">{dataRow.length}</TableCell>

        </TableRow>
      </TableFooter>
    </Table>
  );
}
