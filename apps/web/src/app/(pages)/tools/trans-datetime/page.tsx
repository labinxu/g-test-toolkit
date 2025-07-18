'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CalendarArrowDownIcon } from 'lucide-react';
import { useState } from 'react';

export default function Page() {
  const [timestamp, setTimestamp] = useState<number>(Date.now());
  const [transDate, setTransDate] = useState('');

  const [dateString, setDateString] = useState('');
  const [transdTimestamp, setTransdTimestamp] = useState('');
  return (
    <div className="flex w-full flex-1 flex-col gap-3 rounded-lg border-2 p-8 shadow-lg">
      <div className="w-3xl flex h-12 flex-row items-center justify-center gap-3 rounded-lg p-2 shadow-lg">
        <Label htmlFor="timestamp" className="w-full">
          Timestamp:
          <Input
            value={timestamp}
            type="number"
            onChange={(e: any) => setTimestamp(parseInt(e.target.value))}
            id="timestamp"
          />
        </Label>
        <Button
          variant={'secondary'}
          size={'icon'}
          onClick={() => {
            const date = new Date(timestamp);
            const localDateTime = date
              .toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })
              .replace(/\//g, '-');

            setTransDate(localDateTime);
          }}
        >
          <CalendarArrowDownIcon />
        </Button>
        <Label htmlFor="localeDate" className="w-full">
          Date:
          <Input id="localeDate" readOnly value={transDate} />
        </Label>
      </div>
      {/* trans date to timestamp */}
      <div className="w-3xl flex h-12 flex-row items-center justify-center gap-3 rounded-lg p-2 shadow-lg">
        <Label htmlFor="date-string" className="w-full">
          Date:
          <Input
            value={dateString}
            onChange={(e: any) => setDateString(e.target.value)}
            id="date-string"
          />
        </Label>
        <Button
          variant={'secondary'}
          size={'icon'}
          onClick={() => {
            const timestamp = new Date(
              dateString.replace(/\//g, '-'),
            ).getTime();
            setTransdTimestamp(timestamp.toString());
          }}
        >
          <CalendarArrowDownIcon />
        </Button>
        <Label htmlFor="transd-timestamp" className="w-full">
          timestamp:
          <Input id="transd-timestamp" readOnly value={transdTimestamp} />
        </Label>
      </div>
    </div>
  );
}
