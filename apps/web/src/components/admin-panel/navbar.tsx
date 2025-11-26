'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { ModeToggle } from '@/components/mode-toggle'
import { UserNav } from '@/components/admin-panel/user-nav'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useQuickFavorites, QUICK_LINK_BY_ID } from '@/hooks/use-quick-links'

export function Navbar() {
  const pathname = usePathname()
  const { favorites } = useQuickFavorites()

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary sticky top-0 z-10 w-full rounded-lg shadow-lg backdrop-blur">
      <div className="mx-1 flex h-10 items-center sm:mx-2">
        <div className="flex flex-1 items-center justify-between gap-2">
          <TooltipProvider disableHoverableContent>
            <div className="flex items-center gap-1">
              {favorites.map((id) => {
                const item = QUICK_LINK_BY_ID[id]
                if (!item) return null
                const Icon = item.icon
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href)
                return (
                  <Tooltip key={id} delayDuration={100}>
                    <TooltipTrigger asChild>
                      <Button
                        asChild
                        variant={active ? 'secondary' : 'ghost'}
                        size="icon"
                        aria-label={item.label}
                      >
                        <Link href={item.href}>
                          <Icon className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span className="text-xs">{item.label}</span>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </TooltipProvider>

          <div className="flex flex-row items-center gap-1">
            <ModeToggle />
            <UserNav />
          </div>
        </div>
      </div>
    </header>
  )
}
