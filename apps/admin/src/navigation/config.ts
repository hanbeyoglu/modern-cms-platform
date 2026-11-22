export type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  permission: string | null;
  /** User must hold at least one of these (OR). Overrides `permission` when set. */
  anyPermission?: string[];
  /** If set, the tenant must have this capability enabled for the item to appear. */
  capability?: string;
  /** If true, only Super Admins see this item (no tenant context needed). */
  superAdminOnly?: boolean;
  /** Hide when audit logging is disabled (AUDIT_ENABLED / VITE_AUDIT_ENABLED). */
  requiresAudit?: boolean;
  group?: string;
  /** Optional nested section label within a group (e.g. Lokalizasyon under Sistem). */
  subgroup?: string;
};

/**
 * Ordered by how often mall staff need each area: daily work first,
 * administrative / technical settings last.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Gösterge Paneli', icon: '◉', href: '/dashboard', permission: null, group: 'Genel Bakış' },
  { id: 'contact-messages', label: 'İletişim Mesajları', icon: '✉', href: '/contact-messages', permission: 'contact-message:read', group: 'Genel Bakış' },
  { id: 'notifications', label: 'Bildirimler', icon: '✦', href: '/notifications', permission: 'notification:read', capability: 'notifications', group: 'Genel Bakış' },
  { id: 'analytics', label: 'Raporlar', icon: '∑', href: '/analytics', permission: 'analytics:view', capability: 'analytics', group: 'Genel Bakış' },
  { id: 'search', label: 'Genel Arama', icon: '⌕', href: '/search', permission: 'search:global', capability: 'search', group: 'Genel Bakış' },
  { id: 'campaigns', label: 'Kampanyalar', icon: '◈', href: '/campaigns', permission: 'campaign:read', capability: 'campaigns', group: 'İçerik Yönetimi' },
  { id: 'events', label: 'Etkinlikler', icon: '◷', href: '/events', permission: 'event:read', capability: 'events', group: 'İçerik Yönetimi' },
  { id: 'sliders', label: 'Slaytlar', icon: '▦', href: '/sliders', permission: 'slider:read', capability: 'sliders', group: 'İçerik Yönetimi' },
  { id: 'popups', label: 'Açılır Pencereler', icon: '◆', href: '/popups', permission: 'popup:read', capability: 'popups', group: 'İçerik Yönetimi' },
  { id: 'pages', label: 'Sayfalar', icon: '◧', href: '/pages', permission: 'page:read', capability: 'pages', group: 'İçerik Yönetimi' },
  { id: 'media', label: 'Medya Kütüphanesi', icon: '▤', href: '/media', permission: 'media:read', capability: 'media', group: 'İçerik Yönetimi' },
  { id: 'movies', label: 'Filmler', icon: '◐', href: '/movies', permission: 'movie:read', capability: 'cinema', group: 'İçerik Yönetimi', subgroup: 'Sinema' },
  { id: 'movie-categories', label: 'Film Kategorileri', icon: '◑', href: '/movie-categories', permission: 'movie:read', capability: 'cinema', group: 'İçerik Yönetimi', subgroup: 'Sinema' },
  { id: 'tmdb-hub', label: 'TMDB Film Aktarımı', icon: '◎', href: '/tmdb-hub', permission: 'movie:read', capability: 'cinema', group: 'İçerik Yönetimi', subgroup: 'Sinema' },
  { id: 'mall-stores', label: 'AVM Mağazaları', icon: '▩', href: '/mall-stores', permission: 'mall-store:read', capability: 'stores', group: 'AVM ve Mağazalar' },
  { id: 'store-categories', label: 'Mağaza Kategorileri', icon: '▧', href: '/store-categories', permission: 'store-category:read', capability: 'stores', group: 'AVM ve Mağazalar' },
  { id: 'floors', label: 'Katlar', icon: '▥', href: '/floors', permission: null, anyPermission: ['location:read', 'mall-store:read'], capability: 'stores', group: 'AVM ve Mağazalar' },
  { id: 'services', label: 'Hizmetler', icon: '◇', href: '/services', permission: 'service:read', capability: 'location_services', group: 'AVM ve Mağazalar' },
  { id: 'restaurants', label: 'Restoranlar', icon: '◔', href: '/restaurants', permission: 'location:read', capability: 'stores', group: 'AVM ve Mağazalar' },
  { id: 'cinemas', label: 'Sinemalar', icon: '▶', href: '/cinemas', permission: 'cinema:read', capability: 'cinema', group: 'AVM ve Mağazalar' },
  { id: 'global-stores', label: 'Mağaza Havuzu', icon: '▣', href: '/global-stores', permission: 'global-store:read', capability: 'stores', group: 'AVM ve Mağazalar' },
  { id: 'locations', label: 'Lokasyonlar', icon: '◈', href: '/locations', permission: 'location:read', group: 'Yönetim' },
  { id: 'users', label: 'Kullanıcılar', icon: '◉', href: '/users', permission: 'user:read', group: 'Yönetim' },
  { id: 'roles', label: 'Roller', icon: '◧', href: '/roles', permission: 'role:read', group: 'Yönetim' },
  { id: 'settings-general', label: 'Genel Ayarlar', icon: '◧', href: '/settings/general', permission: 'settings:read', group: 'Yönetim' },
  { id: 'settings-languages', label: 'Diller', icon: '◌', href: '/settings/languages', permission: 'location:read', capability: 'localization', group: 'Yönetim' },
  { id: 'settings-security', label: 'Güvenlik', icon: '◫', href: '/settings/security', permission: 'settings:read', group: 'Yönetim' },
  { id: 'media-guidelines', label: 'Medya Boyut Ayarları', icon: '▥', href: '/media/guidelines', permission: 'media:read', capability: 'media', group: 'Yönetim' },
  { id: 'audit-logs', label: 'Denetim Günlükleri', icon: '◫', href: '/audit-logs', permission: 'audit:read', requiresAudit: true, group: 'Yönetim' },
  { id: 'settings-developer-api', label: 'API Yönetimi', icon: '⌗', href: '/settings/developer-api', permission: 'settings:read', group: 'Geliştirici Araçları' },
  { id: 'settings-movie-providers', label: 'Film Sağlayıcıları (TMDB)', icon: '◎', href: '/settings/movie-providers', permission: 'settings:read', capability: 'cinema', group: 'Geliştirici Araçları' },
  { id: 'tenants', label: 'Müşteriler', icon: '◑', href: '/tenants', permission: 'tenant:read', superAdminOnly: true, group: 'Platform' },
  { id: 'capabilities', label: 'Lisanslar', icon: '◎', href: '/capabilities', permission: 'capability:read', superAdminOnly: true, group: 'Platform' },
  { id: 'system-languages', label: 'Sistem Dilleri', icon: '◌', href: '/system/localization/languages', permission: 'system-language:read', capability: 'localization', superAdminOnly: true, group: 'Platform' },
  { id: 'account', label: 'Hesabım', icon: '◌', href: '/account', permission: null },
];

export type NavGroupId =
  | 'Genel Bakış'
  | 'İçerik Yönetimi'
  | 'AVM ve Mağazalar'
  | 'Yönetim'
  | 'Geliştirici Araçları'
  | 'Platform';

export type NavGroupConfig = {
  id: NavGroupId;
  /** Open on first visit; the user can still collapse it (remembered per user). */
  defaultOpen: boolean;
};

export const NAV_GROUPS: NavGroupConfig[] = [
  { id: 'Genel Bakış', defaultOpen: true },
  { id: 'İçerik Yönetimi', defaultOpen: true },
  { id: 'AVM ve Mağazalar', defaultOpen: true },
  { id: 'Yönetim', defaultOpen: false },
  { id: 'Geliştirici Araçları', defaultOpen: false },
  { id: 'Platform', defaultOpen: false },
];

/** Sub-sections inside a group; closed by default unless the active page lives there. */
export const NAV_SUBGROUP_DEFAULT_OPEN = false;

export type NavAccessContext = {
  isSuperAdmin: boolean;
  auditEnabled: boolean;
  can: (code: string) => boolean;
  canAny: (...codes: string[]) => boolean;
  hasCapability: (code: string) => boolean;
};

/** Same access rules the sidebar always used: audit flag, super admin, permission(s), capability. */
export function isNavItemVisible(item: NavItem, ctx: NavAccessContext): boolean {
  if (item.requiresAudit && !ctx.auditEnabled) return false;
  if (item.superAdminOnly && !ctx.isSuperAdmin) return false;
  if (item.anyPermission && item.anyPermission.length > 0) {
    if (!ctx.canAny(...item.anyPermission)) return false;
  } else if (item.permission !== null && !ctx.can(item.permission)) return false;
  if (item.capability && !ctx.isSuperAdmin && !ctx.hasCapability(item.capability)) return false;
  return true;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (!pathname.startsWith(`${item.href}/`)) return false;
  // '/media' must not claim '/media/guidelines' (its own menu entry).
  return !NAV_ITEMS.some((other) => other !== item && other.href.startsWith(`${item.href}/`) && (pathname === other.href || pathname.startsWith(`${other.href}/`)));
}

/**
 * Platform pages (super-admin only menu items such as Müşteriler) manage the platform itself,
 * not one tenant/AVM, so they must open without a selected workspace.
 * Access is still enforced by each route's PermissionGate (superAdminOnly).
 */
export function isPlatformPath(pathname: string): boolean {
  return NAV_ITEMS.some(
    (item) => item.superAdminOnly && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}
