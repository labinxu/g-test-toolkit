import {
  Settings,
  SquarePen,
  LayoutGrid,
  LucideIcon,
  TabletSmartphone,
  CommandIcon,
  UtensilsCrossedIcon,
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
  groupLabel: string
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
      groupLabel: 'Contents',
      menus: [
        {
          href: '',
          label: 'TestCases',
          icon: SquarePen,
          submenus: [
            {
              href: '/testcases',
              label: 'User Case',
            },
            {
              href: '/testcases/libs',
              label: 'Libs',
            },
            {
              href: '/reports',
              label: 'Report',
            },
            {
              href: '/testcases/app',
              label: 'APP',
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
          href: '/tools',
          label: 'Tools',
          icon: UtensilsCrossedIcon,
          submenus: [
            {
              label: 'DateTime',
              href: '/tools/trans-datetime',
            },
            {
              label: 'Android Inspector',
              href: '/tools/android-inspector',
            },
            {
              label: 'Account',
              href: '/tools/account',
            },
            {
              label: 'FastUserInfo',
              href: '/tools/fast-user-db',
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
          href: '/account',
          label: 'Account',
          icon: Settings,
        },
      ],
    },
  ]
}
