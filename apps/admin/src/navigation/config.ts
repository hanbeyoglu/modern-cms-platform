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
    permission: 'media:read',
  },
  {
    id: 'sliders',
    label: 'Slider Yönetimi',
    icon: '▦',
    href: '/sliders',
    permission: 'slider:read',
  },
  {
    id: 'events',
    label: 'Etkinlikler',
    icon: '◷',
    href: '/events',
    permission: 'event:read',
    group: 'İçerik',
  },
  {
    id: 'analytics',
    label: 'Raporlar',
    icon: '∑',
    href: '/analytics',
    permission: 'analytics:view',
    group: 'Analitik',
  },
  {
    id: 'cinemas',
    label: 'Sinemalar',
    icon: '▶',
    href: '/cinemas',
    permission: 'cinema:read',
    group: 'İçerik',
  },
  {
    id: 'movies',
    label: 'Filmler',
    icon: '◐',
    href: '/movies',
    permission: 'movie:read',
    group: 'İçerik',
  },
  {
    id: 'movie-sessions',
    label: 'Seanslar',
    icon: '◷',
    href: '/movie-sessions',
    permission: 'movie-session:read',
    group: 'İçerik',
  },
  {
    id: 'pages',
    label: 'Sayfalar',
    icon: '◧',
    href: '/pages',
    permission: 'page:read',
    group: 'İçerik',
  },
  {
    id: 'locales',
    label: 'Diller',
    icon: '◌',
    href: '/locales',
    permission: 'locale:read',
    group: 'İçerik',
  },
  {
    id: 'campaigns',
    label: 'Kampanyalar',
    icon: '◈',
    href: '/campaigns',
    permission: 'campaign:read',
    group: 'İçerik',
  },
  {
    id: 'store-categories',
    label: 'Mağaza Kategorileri',
    icon: '◫',
    href: '/store-categories',
    permission: 'store-category:read',
    group: 'Mağazalar',
  },
  {
    id: 'global-stores',
    label: 'Global Mağazalar',
    icon: '▣',
    href: '/global-stores',
    permission: 'global-store:read',
    group: 'Mağazalar',
  },
  {
    id: 'mall-stores',
    label: 'AVM Mağazaları',
    icon: '▩',
    href: '/mall-stores',
    permission: 'mall-store:read',
    group: 'Mağazalar',
  },
];

export const NAV_GROUPS = ['Analitik', 'İçerik', 'Mağazalar'] as const;
