import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutGrid,
  SquarePen,
  LibraryBig,
  InspectionPanel,
  FileSpreadsheet,
  TabletSmartphone,
  NetworkIcon,
} from 'lucide-react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { useSession } from '@/app/context/session-context'

export type QuickLinkId =
  | 'dashboard'
  | 'testcases'
  | 'libs'
  | 'scenarios'
  | 'api-corebe'
  | 'reports'
  | 'devices'
  | 'inspector'
  | 'mobile-network'

export type QuickLink = {
  id: QuickLinkId
  href: string
  label: string
  description?: string
  icon: LucideIcon
}

export const ALL_QUICK_LINKS: QuickLink[] = [
  {
    id: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    description: '主工作台总览',
    icon: LayoutGrid,
  },
  {
    id: 'testcases',
    href: '/testcases',
    label: 'Testcases',
    description: '脚本用例编辑与执行',
    icon: SquarePen,
  },
  {
    id: 'libs',
    href: '/testcases/libs',
    label: 'Libs',
    description: '公共库与路由配置',
    icon: LibraryBig,
  },
  {
    id: 'scenarios',
    href: '/scenarios',
    label: 'Scenarios',
    description: '场景用例与业务流',
    icon: FileSpreadsheet,
  },
  {
    id: 'api-corebe',
    href: '/api-tests/core-be',
    label: 'API Core-be',
    description: 'Core-be 接口回归测试',
    icon: NetworkIcon,
  },
  {
    id: 'reports',
    href: '/reports',
    label: 'Reports',
    description: '自动化执行报告',
    icon: FileSpreadsheet,
  },
  {
    id: 'devices',
    href: '/devices',
    label: 'Devices',
    description: '设备与模拟器管理',
    icon: TabletSmartphone,
  },
  {
    id: 'inspector',
    href: '/tools/android-inspector',
    label: 'Android Inspector',
    description: '移动端页面结构查看',
    icon: InspectionPanel,
  },
  {
    id: 'mobile-network',
    href: '/tools/mobile-network',
    label: 'Mobile Network',
    description: '移动网络抓包与 Frida',
    icon: NetworkIcon,
  },
]

export const QUICK_LINK_BY_ID: Record<QuickLinkId, QuickLink> =
  ALL_QUICK_LINKS.reduce(
    (acc, link) => {
      acc[link.id] = link
      return acc
    },
    {} as Record<QuickLinkId, QuickLink>,
  )

const DEFAULT_FAVORITES: QuickLinkId[] = [
  'testcases',
  'libs',
  'inspector',
  'reports',
]

type QuickFavoritesStore = {
  byUser: Record<string, QuickLinkId[]>
  setFavoritesForUser: (userKey: string, favorites: QuickLinkId[]) => void
}

const useQuickFavoritesStore = create(
  persist<QuickFavoritesStore>(
    (set) => ({
      byUser: {},
      setFavoritesForUser: (userKey, favorites) =>
        set((state) => ({
          byUser: { ...state.byUser, [userKey]: favorites },
        })),
    }),
    {
      name: 'gtt:navbar:favorites',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export function useQuickFavorites() {
  const { user } = useSession()
  const userKey = user?.username || 'default'
  const byUser = useQuickFavoritesStore((state) => state.byUser)
  const setFavoritesForUser = useQuickFavoritesStore(
    (state) => state.setFavoritesForUser,
  )
  const favorites = byUser[userKey] ?? DEFAULT_FAVORITES

  useEffect(() => {
    if (!byUser[userKey]) {
      setFavoritesForUser(userKey, DEFAULT_FAVORITES)
    }
  }, [byUser, setFavoritesForUser, userKey])

  const toggleFavorite = (id: QuickLinkId, enabled: boolean) => {
    const current = byUser[userKey] ?? DEFAULT_FAVORITES
    const exists = current.includes(id)

    if (enabled && !exists) {
      setFavoritesForUser(userKey, [...current, id])
      return
    }

    if (!enabled && exists) {
      setFavoritesForUser(
        userKey,
        current.filter((x) => x !== id),
      )
    }
  }

  return { favorites, toggleFavorite }
}
