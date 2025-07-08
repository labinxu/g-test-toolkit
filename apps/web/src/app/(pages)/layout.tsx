'use client';
import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPanelLayout from '@/components/admin-panel/admin-panel-layout';
import { SessionProvider } from '../context/session-context';
const queryClient = new QueryClient();
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminPanelLayout>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense>{children}</Suspense>
        </QueryClientProvider>
      </SessionProvider>
    </AdminPanelLayout>
  );
}
