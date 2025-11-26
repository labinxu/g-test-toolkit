'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogOut, User, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useSession } from '@/app/context/session-context'
import { ALL_QUICK_LINKS, useQuickFavorites } from '@/hooks/use-quick-links'

export function UserNav() {
  const { user, logout } = useSession()
  const { favorites, toggleFavorite } = useQuickFavorites()
  const [quickDialogOpen, setQuickDialogOpen] = useState(false)

  return (
    <>
      <Dialog open={quickDialogOpen} onOpenChange={setQuickDialogOpen}>
        <DropdownMenu>
          <TooltipProvider disableHoverableContent>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="#" alt="Avatar" />
                      <AvatarFallback className="bg-transparent">
                        {user?.username.toUpperCase().substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Profile</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.username}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="hover:cursor-pointer" asChild>
                <Link href="/users" className="flex items-center">
                  <User className="mr-3 h-4 w-4 text-muted-foreground" />
                  Users
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="hover:cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault()
                  setQuickDialogOpen(true)
                }}
              >
                <div className="flex items-center">
                  <Star className="mr-3 h-4 w-4 text-muted-foreground" />
                  <span>快捷选项</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="hover:cursor-pointer"
              onClick={logout}
            >
              <LogOut className="mr-3 h-4 w-4 text-muted-foreground" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>快捷选项</DialogTitle>
            <DialogDescription>
              勾选你常用的页面，这些入口会以图标的形式显示在导航栏左侧。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2">
            {ALL_QUICK_LINKS.map((item) => {
              const Icon = item.icon
              const checked = favorites.includes(item.id)
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleFavorite(item.id, !checked)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleFavorite(item.id, !checked)
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleFavorite(item.id, value === true)
                    }
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    className="mr-1"
                  />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.label}</span>
                    {item.description && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
