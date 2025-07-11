'use client';
import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPanelLayout from '@/components/admin-panel/admin-panel-layout';
import { ContentLayout } from '@/components/admin-panel/content-layout';
const queryClient = new QueryClient();
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AdminPanelLayout>
      <ContentLayout>
        <QueryClientProvider client={queryClient}>
          <Suspense>{children}</Suspense>
        </QueryClientProvider>
      </ContentLayout>
    </AdminPanelLayout>
  );
}
