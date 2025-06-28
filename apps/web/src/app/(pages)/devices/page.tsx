'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GTable } from './components/g-table';
const headers = { 'Content-Type': 'application/json' };

export default function Page() {
  const [devices, setDevices] = useState<string>('');
  const [deviceList, setDeviceList] = useState<string[][]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [selectedDeviceId, setSelectDeviceId] = useState<string>('');
  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () =>
      fetch(`/api/android/devices`, {
        method: 'GET',
        //credentials: "include",
        headers: { ...headers },
      }).then((res) => {
        if (res.ok) {
          return res.json();
        }
      }),
  });
  useEffect(() => {
    if (devicesQuery.isPending) return;
    const { devices } = devicesQuery.data;
    setDevices(devices);
  }, [devicesQuery]);
  useEffect(() => {
    if (devices != '') {
      const dlist = devices
        .split('\n')
        .filter((v: string) => v != '')
        .filter((v: string) => v.endsWith('device'));
      let dls = dlist.map((l: string) => l.split('\t'));
      dls.forEach((dl) => dl.push('Free'));
      setDeviceList(dls);
    }
  }, [devices]);
  const onSelectedRow = useCallback((data: string[]) => {
    console.log('selected', data);
    setSelectDeviceId(data[0]);
  }, []);
  return (
    <div className="rounded-lg shadow-lg m-4 gap-3 border-2">
      <span className="font-medium m-1">Device Table:</span>
      <div className="gap-3 pt-1 rounded-lg shadow-lg">
        <GTable
          headers={['SN', 'type']}
          dataRow={deviceList}
          onSelectedRow={onSelectedRow}
        />
      </div>
    </div>
  );
}
