import { ModeToggle } from '@/components/mode-toggle';
import { UserNav } from '@/components/admin-panel/user-nav';
import { SheetMenu } from '@/components/admin-panel/sheet-menu';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathName = usePathname();
  return (
    <header className="sticky top-0 z-10 w-full bg-background/95 rounded-lg shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary">
      <div className="mx-1 sm:mx-2 flex h-10 items-center ">
        <div className="flex items-center space-x-4 lg:space-x-0 ">
          <SheetMenu />
          <h1 className="font-bold">{pathName}</h1>
        </div>
        <div className="flex flex-1 items-center justify-end">
          <ModeToggle />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
