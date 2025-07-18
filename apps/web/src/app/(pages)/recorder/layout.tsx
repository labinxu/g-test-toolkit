'use client';
import { SocketProvider } from '@/components/providers/socket-provider';
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SocketProvider url="http://127.0.0.1:3002/replay">
      {children}
    </SocketProvider>
  );
}
