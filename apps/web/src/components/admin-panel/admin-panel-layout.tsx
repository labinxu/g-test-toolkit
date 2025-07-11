'use client';

import { Footer } from '@/components/admin-panel/footer';
import { Sidebar } from '@/components/admin-panel/sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { useStore } from '@/hooks/use-store';
import { cn } from '@/lib/utils';

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  const { getOpenState, settings } = sidebar;
  return (
    <div className="flex flex-col min-h-screen">
      <Sidebar />
      <main
        className={cn(
          'flex-1 min-h-0  rounded-lg shadow-lg bg-zinc-50 pl-4 dark:bg-zinc-900 transition-[margin-left] ease-in-out duration-300 grow',
          !settings.disabled && (!getOpenState() ? 'lg:ml-[90px]' : 'lg:ml-72'),
        )}
      >
        {children}
      </main>
      {/*
      <footer
        className={cn(
          'transition-[margin-left] ease-in-out duration-300',
          !settings.disabled && (!getOpenState() ? 'lg:ml-[90px]' : 'lg:ml-72'),
        )}
      >
        <Footer />
        </footer>*/}
    </div>
  );
}
