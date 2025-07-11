'use client';
import { Navbar } from '@/components/admin-panel/navbar';

import { useRef, useEffect, useState } from 'react';

interface ContentLayoutProps {
  children: React.ReactNode;
}

export function ContentLayout({ children }: ContentLayoutProps) {
  const navbarRef = useRef<HTMLDivElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(56);

  useEffect(() => {
    if (navbarRef.current) {
      setNavbarHeight(navbarRef.current.offsetHeight);
    }
  }, []);

  return (
    <div className="container flex flex-1 flex-col">
      <div ref={navbarRef}>
        <Navbar />
      </div>
      <div
        className="flex overflow-y-auto dark:bg-zinc-900 rounded-lg shadow-lg pt-1 m-h-[calc(100vh-)]"
        style={{ height: `calc(100vh - ${navbarHeight}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
