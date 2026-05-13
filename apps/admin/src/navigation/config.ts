export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  permission: string | null;
  group?: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Gösterge Paneli',
    icon: '◉',
    href: '/dashboard',
    permission: null,
  },
  {
    id: 'media',
    label: 'Medya Kütüphanesi',
    icon: '▤',
    href: '/media',
    permission: 'media:list',
  },
  {
    id: 'sliders',
    label: 'Slider Yönetimi',
    icon: '▦',
    href: '/sliders',
    permission: 'sliders:list',
  },
  {
    id: 'events',
    label: 'Etkinlikler',
    icon: '◷',
    href: '/events',
    permission: 'events:list',
    group: 'İçerik',
  },
  {
    id: 'campaigns',
    label: 'Kampanyalar',
    icon: '◈',
    href: '/campaigns',
    permission: 'campaigns:list',
    group: 'İçerik',
  },
  {
    id: 'store-categories',
    label: 'Mağaza Kategorileri',
    icon: '◫',
    href: '/store-categories',
    permission: 'stores:list',
    group: 'Mağazalar',
  },
  {
    id: 'global-stores',
    label: 'Global Mağazalar',
    icon: '▣',
    href: '/global-stores',
    permission: 'stores:list',
    group: 'Mağazalar',
  },
  {
    id: 'mall-stores',
    label: 'AVM Mağazaları',
    icon: '▩',
    href: '/mall-stores',
    permission: 'stores:list',
    group: 'Mağazalar',
  },
];

export const NAV_GROUPS = ['İçerik', 'Mağazalar'] as const;
