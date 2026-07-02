// ── Media ─────────────────────────────────────────────────────────────────────

export interface PublicMediaAsset {
  id: string;
  url: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  widthOverride: number | null;
  heightOverride: number | null;
  alt: string | null;
  caption: string | null;
  dominantColor: string | null;
}

/** @deprecated Use PublicMediaAsset */
export type PublicMediaRef = PublicMediaAsset;

export interface PublicMediaGuideline {
  usageKey: string;
  label: string;
  recommendedWidth: number;
  recommendedHeight: number;
  acceptedMimeTypes: string[];
  helperText: string | null;
  aspectRatioLocked: boolean;
}

// ── SEO ───────────────────────────────────────────────────────────────────────

export interface PublicSeoMeta {
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  image: string | null;
  canonicalUrl: string | null;
  locale: string | null;
}

// ── Response Envelope ─────────────────────────────────────────────────────────

export interface PublicEnvelopeTenant {
  id: string;
  mallId: string | null;
}

export interface PublicEnvelope<T> {
  success: true;
  locale: string | null;
  tenant: PublicEnvelopeTenant;
  data: T;
}

export interface PublicPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublicPaginatedEnvelope<T> {
  success: true;
  locale: string | null;
  tenant: PublicEnvelopeTenant;
  pagination: PublicPaginationMeta;
  data: T[];
}

export function makeEnvelope<T>(
  data: T,
  context: { tenantId: string; mallId?: string | null; locale: string | null },
): PublicEnvelope<T> {
  return {
    success: true,
    locale: context.locale,
    tenant: { id: context.tenantId, mallId: context.mallId ?? null },
    data,
  };
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PublicPaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { page, limit, total, totalPages };
}

export function makePaginatedEnvelope<T>(
  data: T[],
  pagination: PublicPaginationMeta,
  context: { tenantId: string; mallId?: string | null; locale: string | null },
): PublicPaginatedEnvelope<T> {
  return {
    success: true,
    locale: context.locale,
    tenant: { id: context.tenantId, mallId: context.mallId ?? null },
    pagination,
    data,
  };
}

// ── Entity Types ──────────────────────────────────────────────────────────────

export interface PublicSliderItem {
  id: string;
  title: string | null;
  description: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  desktopMedia: PublicMediaAsset | null;
  mobileMedia: PublicMediaAsset | null;
  /** Locale-resolved desktop image (alias for desktopMedia) */
  image: PublicMediaAsset | null;
  /** Locale-resolved mobile image (alias for mobileMedia) */
  mobileImage: PublicMediaAsset | null;
  sortOrder: number;
  status: string;
}

export interface PublicSlider {
  id: string;
  title: string;
  placementType: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  sortOrder: number;
  startAt: string | null;
  endAt: string | null;
  items: PublicSliderItem[];
  /** @deprecated Use items[]. Populated from first item for backward compatibility. */
  subtitle: string | null;
  /** @deprecated Use items[]. Populated from first item for backward compatibility. */
  description: string | null;
  /** @deprecated Use items[]. Populated from first item for backward compatibility. */
  desktopMedia: PublicMediaAsset | null;
  /** @deprecated Use items[]. Populated from first item for backward compatibility. */
  mobileMedia: PublicMediaAsset | null;
  /** @deprecated Use items[]. Always null. */
  videoMedia: PublicMediaAsset | null;
  /** @deprecated Use items[].linkUrl */
  linkType: string;
  /** @deprecated Use items[].linkUrl */
  linkValue: string | null;
  /** @deprecated Use items[].buttonText */
  buttonText: string | null;
  /** @deprecated Removed; always ALL */
  targetDevice: string;
}

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  /** Locale-resolved cover image */
  image: PublicMediaAsset | null;
  /** @deprecated Use image */
  coverMedia: PublicMediaAsset | null;
  publishStartAt: string | null;
  publishEndAt: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  /** @deprecated Use eventStartAt */
  startAt: string | null;
  /** @deprecated Use eventEndAt */
  endAt: string | null;
  location: string | null;
  category: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: string | null;
  seo: PublicSeoMeta;
}

export interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  /** Locale-resolved cover image */
  image: PublicMediaAsset | null;
  /** Locale-resolved mobile cover image */
  mobileImage: PublicMediaAsset | null;
  /** @deprecated Use image */
  coverMedia: PublicMediaAsset | null;
  publishStartAt: string | null;
  publishEndAt: string | null;
  campaignStartAt: string | null;
  campaignEndAt: string | null;
  /** @deprecated Use campaignStartAt */
  startAt: string | null;
  /** @deprecated Use campaignEndAt */
  endAt: string | null;
  terms: string | null;
  couponCode: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: string | null;
  store: { id: string; name: string; slug: string } | null;
  seo: PublicSeoMeta;
}

export interface PublicPageBlock {
  id: string;
  type: string;
  title: string | null;
  dataJson: unknown;
  sortOrder: number;
}

export interface PublicPageAttachment {
  id: string;
  title: string | null;
  description: string | null;
  mediaId: string;
  sortOrder: number;
  downloadable: boolean;
  media: PublicMediaAsset | null;
}

export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  type: string;
  customTypeLabel: string | null;
  contentHtml: string | null;
  renderMode: 'HTML' | 'SINGLE_PDF' | 'DOCUMENT_LIST';
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishedAt: string | null;
  attachments: PublicPageAttachment[];
  blocks: PublicPageBlock[];
  seo: PublicSeoMeta;
}

export interface PublicStoreFloor {
  id: string;
  name: string;
  label: string;
}

export interface PublicStoreCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: PublicMediaAsset | null;
  cover: PublicMediaAsset | null;
}

export interface PublicStoreSocialLink {
  platform: string;
  url: string;
}

export interface PublicStore {
  id: string;
  mallId: string;
  name: string;
  detailTitle: string | null;
  /** @deprecated Use detailTitle */
  displayTitle?: string | null;
  description: string | null;
  floor: PublicStoreFloor | null;
  /** @deprecated Use floor.label */
  floorLabel?: string | null;
  storeNo: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  workingHours: unknown;
  /** @deprecated Use workingHours */
  workingHoursJson?: unknown;
  locationJson: unknown;
  isFeatured: boolean;
  isSoon: boolean;
  searchTags: string[];
  sortOrder: number;
  logo: PublicMediaAsset | null;
  globalStore: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    logo: PublicMediaAsset | null;
    socialLinks: PublicStoreSocialLink[];
  };
  /** @deprecated Use category; kept for backward compatibility. */
  categories: { id: string; name: string; slug: string }[];
  category: PublicStoreCategory | null;
  seo: PublicSeoMeta;
}

export interface PublicCinema {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: PublicMediaAsset | null;
}

export interface PublicMovieSession {
  id: string;
  cinema: { id: string; name: string; slug: string };
  movie: {
    id: string;
    title: string;
    slug: string;
    durationMinutes: number | null;
    releaseDate: string | null;
    ticketUrl: string | null;
    poster: PublicMediaAsset | null;
    categories: { id: string; name: string; slug: string }[];
  };
  hallName: string | null;
  startsAt: string;
  endsAt: string | null;
  language: string | null;
  subtitle: string | null;
  format: string | null;
  ticketUrl: string | null;
}

export interface PublicPopup {
  id: string;
  title: string;
  description: string | null;
  image: PublicMediaAsset | null;
  linkUrl: string | null;
  buttonText: string | null;
  channels: string[];
  showOnce: boolean;
  closable: boolean;
  startAt: string | null;
  endAt: string | null;
  sortOrder: number;
}

export interface PublicLocationService {
  id: string;
  mallId: string;
  name: string;
  description: string | null;
  icon: PublicMediaAsset | null;
  cover: PublicMediaAsset | null;
  category: string | null;
  floor: string | null;
  unitNo: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  searchTags: string[];
  isSoon: boolean;
  sortOrder: number;
}

export interface PublicHomeResponse {
  locale: string | null;
  defaultLocale: string | null;
  sliders: PublicSlider[];
  featuredStores: PublicStore[];
  upcomingEvents: PublicEvent[];
  activeCampaigns: PublicCampaign[];
  todayMovieSessions: PublicMovieSession[];
}

export interface PublicLocationInfo {
  id: string;
  type: string;
  name: string;
  displayName: string | null;
  slug: string;
  websiteUrl: string | null;
  phone: string | null;
  supportEmail: string | null;
  logo: PublicMediaAsset | null;
  cover: PublicMediaAsset | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    district: string | null;
    country: string | null;
    postalCode: string | null;
  } | null;
  coordinates: { latitude: number; longitude: number } | null;
  timezone: string | null;
  workingHours: unknown;
  socialLinks: unknown;
}

export interface PublicSiteSupportedLocale {
  code: string;
  name: string;
  rtl: boolean;
}

export interface PublicSiteLanguage {
  code: string;
  default: boolean;
  rtl: boolean;
}

export interface PublicSiteConfig {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  mallId: string | null;
  mallName: string | null;
  mallSlug: string | null;
  location: PublicLocationInfo | null;
  /** Enabled tenant locales for public language switchers. */
  supportedLocales: PublicSiteSupportedLocale[];
  /** Active languages for the current location (mall-scoped when x-mall-id is set). */
  languages: PublicSiteLanguage[];
  defaultLocale: string | null;
  activeLocale: string | null;
  rtl: boolean;
}
