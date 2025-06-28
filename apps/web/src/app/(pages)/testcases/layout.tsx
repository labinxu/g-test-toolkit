'use client';
import { SocketProvider } from './socket-content';
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SocketProvider>{children}</SocketProvider>;
}
