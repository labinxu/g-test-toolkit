'use client'
import { Navbar } from '@/components/admin-panel/navbar'

import { useRef, useEffect, useState } from 'react'

interface ContentLayoutProps {
  children: React.ReactNode
  title?: string
}

export function ContentLayout({ children }: ContentLayoutProps) {
  const navbarRef = useRef<HTMLDivElement>(null)
  const [navbarHeight, setNavbarHeight] = useState(56)

  useEffect(() => {
    if (navbarRef.current) {
      setNavbarHeight(navbarRef.current.offsetHeight)
    }
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      <div ref={navbarRef}>
        <Navbar />
      </div>
      <div
        className="flex overflow-x-hidden overflow-y-auto rounded-lg border-2 shadow-lg dark:bg-zinc-900"
        style={{ height: `calc(100vh - ${navbarHeight}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
