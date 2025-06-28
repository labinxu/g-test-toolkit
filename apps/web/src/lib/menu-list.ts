import {
  Users,
  Settings,
  SquarePen,
  LayoutGrid,
  LucideIcon,
  TabletSmartphone,
  CommandIcon,
} from 'lucide-react';

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
};

type Menu = {
  href: string;
  label: string;
  active?: boolean;
  icon: LucideIcon;
  submenus?: Submenu[];
};

type Group = {
  groupLabel: string;
  menus: Menu[];
};

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
              label: 'TestCases',
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
          href: '/users',
          label: 'Users',
          icon: Users,
        },
        {
          href: '/account',
          label: 'Account',
          icon: Settings,
        },
      ],
    },
  ];
}
