export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  permission: string | null;
  /** If set, the tenant must have this capability enabled for the item to appear. */
  capability?: string;
  /** If true, only Super Admins see this item (no tenant context needed). */
  superAdminOnly?: boolean;
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
    id: 'notifications',
    label: 'Bildirimler',
    icon: '✦',
    href: '/notifications',
    permission: 'notification:read',
    capability: 'notifications',
  },
  {
    id: 'search',
    label: 'Genel Arama',
    icon: '⌕',
    href: '/search',
    permission: 'search:global',
    capability: 'search',
  },
  {
    id: 'media',
    label: 'Medya Kütüphanesi',
    icon: '▤',
    href: '/media',
    permission: 'media:read',
    capability: 'media',
  },
  {
    id: 'sliders',
    label: 'Slider Yönetimi',
    icon: '▦',
    href: '/sliders',
    permission: 'slider:read',
    capability: 'sliders',
  },
  {
    id: 'analytics',
    label: 'Raporlar',
    icon: '∑',
    href: '/analytics',
    permission: 'analytics:view',
    capability: 'analytics',
    group: 'Analitik',
  },
  {
    id: 'events',
    label: 'Etkinlikler',
    icon: '◷',
    href: '/events',
    permission: 'event:read',
    capability: 'events',
    group: 'İçerik',
  },
  {
    id: 'campaigns',
    label: 'Kampanyalar',
    icon: '◈',
    href: '/campaigns',
    permission: 'campaign:read',
    capability: 'campaigns',
    group: 'İçerik',
  },
  {
    id: 'pages',
    label: 'Sayfalar',
    icon: '◧',
    href: '/pages',
    permission: 'page:read',
    capability: 'pages',
    group: 'İçerik',
  },
  {
    id: 'locales',
    label: 'Diller',
    icon: '◌',
    href: '/locales',
    permission: 'locale:read',
    capability: 'localization',
    group: 'İçerik',
  },
  {
    id: 'cinemas',
    label: 'Sinemalar',
    icon: '▶',
    href: '/cinemas',
    permission: 'cinema:read',
    capability: 'cinema',
    group: 'İçerik',
  },
  {
    id: 'movies',
    label: 'Filmler',
    icon: '◐',
    href: '/movies',
    permission: 'movie:read',
    capability: 'cinema',
    group: 'İçerik',
  },
  {
    id: 'movie-sessions',
    label: 'Seanslar',
    icon: '◷',
    href: '/movie-sessions',
    permission: 'movie-session:read',
    capability: 'cinema',
    group: 'İçerik',
  },
  {
    id: 'store-categories',
    label: 'Mağaza Kategorileri',
    icon: '◫',
    href: '/store-categories',
    permission: 'store-category:read',
    capability: 'stores',
    group: 'Mağazalar',
  },
  {
    id: 'global-stores',
    label: 'Global Mağazalar',
    icon: '▣',
    href: '/global-stores',
    permission: 'global-store:read',
    capability: 'stores',
    group: 'Mağazalar',
  },
  {
    id: 'mall-stores',
    label: 'AVM Mağazaları',
    icon: '▩',
    href: '/mall-stores',
    permission: 'mall-store:read',
    capability: 'stores',
    group: 'Mağazalar',
  },
  {
    id: 'capabilities',
    label: 'Yetenekler',
    icon: '◎',
    href: '/capabilities',
    permission: 'capability:read',
    superAdminOnly: true,
    group: 'Platform',
  },
];

export const NAV_GROUPS = ['Analitik', 'İçerik', 'Mağazalar', 'Platform'] as const;
