import {
  Settings,
  SquarePen,
  LayoutGrid,
  LucideIcon,
  TabletSmartphone,
  CommandIcon,
  UtensilsCrossedIcon,
  Users,
  FileCog,
  FileText,
  BrickWall,
  FilmIcon,
} from 'lucide-react'

type Submenu = {
  href: string
  label: string
  active?: boolean
  icon?: any
}

type Menu = {
  href: string
  label: string
  active?: boolean
  icon: LucideIcon
  submenus?: Submenu[]
}

type Group = {
  groupLabel?: string
  menus: Menu[]
}

export function getMenuList(pathname: string): Group[] {
  return [
    {
      groupLabel: '',
      menus: [
        {
          href: '/dashboard',
          label: 'Dashboard',
          icon: LayoutGrid,
          submenus: [],
        },
      ],
    },
    {
      groupLabel: '',
      menus: [
        {
          href: '',
          label: 'TestCases',
          icon: SquarePen,
          submenus: [
            {
              href: '/testcases',
              label: 'Case Code',
            },
            {
              href: '/testcases/libs',
              label: 'Libs',
            },
            {
              href: '/testcases/libs/routes',
              label: 'Route Configs',
            },
            {
              href: '/reports',
              label: 'Report',
            },
            {
              href: '/traceability',
              label: 'Tranceability',
            },
          ],
        },
        {
          href: '',
          label: 'Scenarios',
          icon: FilmIcon,
          submenus: [
            {
              href: '/scenarios',
              label: 'Scenarios',
            },
          ],
        },
        {
          href: '',
          label: 'API Test',
          icon: BrickWall,
          submenus: [
            {
              href: '/api-tests/core-be',
              label: 'Corebe',
            },
            {
              href: '/api-tests/notif',
              label: 'Notif',
            },
          ],
        },
        {
          href: '',
          label: 'Commands',
          icon: CommandIcon,
          submenus: [
            {
              href: '/commands/android',
              label: 'Android',
            },
            {
              href: '/commands/web',
              label: 'Web',
            },
            {
              href: '/commands/system',
              label: 'System',
            },
          ],
        },
        {
          href: '/resource',
          label: 'Resource',
          icon: FileText,
          submenus: [
            {
              href: '/resource/videos',
              label: 'Videos',
            },
            {
              href: '/resource/app',
              label: 'APP',
            },
          ],
        },
        {
          href: '/tools',
          label: 'Tools',
          icon: UtensilsCrossedIcon,
          submenus: [
            {
              label: 'Mobile Network',
              href: '/tools/mobile-network',
            },
            {
              label: 'Live Push',
              href: '/tools/live-push',
            },
            {
              label: 'Notif Whitelist',
              href: '/tools/whitelist-post',
            },

            {
              label: 'DateTime',
              href: '/tools/trans-datetime',
            },
            {
              label: 'Android Inspector',
              href: '/tools/android-inspector',
            },
            {
              label: 'FastUserInfo',
              href: '/tools/fast-user-db',
            },
            {
              label: 'StoreComments',
              href: '/tools/store-comments',
            },
            {
              label: 'RegistAccount',
              href: '/tools/register-account',
            },
            {
              label: 'Flutter Pages',
              href: '/tools/flutter-page-objects',
            },
            {
              label: 'CurlCmd',
              href: '/tools/curl-command',
            },
          ],
        },
      ],
    },
    {
      groupLabel: 'Settings',
      menus: [
        {
          href: '/devices',
          label: 'Devices',
          icon: TabletSmartphone,
        },
        {
          href: '',
          label: 'Configure',
          icon: Settings,
          submenus: [
            {
              href: '/settings/parameters',
              label: 'Parameters',
            },
            {
              href: '/settings/action-catalog',
              label: 'Action Catalog',
            },
            {
              href: '/settings/env-templates',
              label: 'Env Templates',
            },
            {
              href: '/settings/logger',
              label: 'Logger',
            },
          ],
        },
        {
          href: '/users',
          label: 'Users',
          icon: Users,
        },
      ],
    },
  ]
}
