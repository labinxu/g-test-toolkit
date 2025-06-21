'use client';
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
export default function Layout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (<QueryClientProvider client={queryClient}>
          <Suspense>{children}</Suspense>
        </QueryClientProvider>
  );
}
