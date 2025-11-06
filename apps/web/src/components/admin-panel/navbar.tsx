import { ModeToggle } from '@/components/mode-toggle'
import { UserNav } from '@/components/admin-panel/user-nav'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SquarePen, LibraryBig, InspectionPanel, FileSpreadsheet } from 'lucide-react'

export function Navbar() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary sticky top-0 z-10 w-full rounded-lg shadow-lg backdrop-blur">
      <div className="mx-1 flex h-10 items-center sm:mx-2">
        <div className="flex flex-1 justify-between gap-2">
          <div>
            <Button asChild variant="ghost" size="icon" aria-label="Testcases">
              <Link href="/testcases">
                <SquarePen />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Libs">
              <Link href="/testcases/libs">
                <LibraryBig />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Inspector">
              <Link href="/tools/android-inspector">
                <InspectionPanel />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Inspector">
              <Link href="/reports">
                <FileSpreadsheet />
              </Link>
            </Button>
          </div>
          <div className="flex flex-row">
            <ModeToggle />
            <UserNav />
          </div>
        </div>
      </div>
    </header>
  )
}
