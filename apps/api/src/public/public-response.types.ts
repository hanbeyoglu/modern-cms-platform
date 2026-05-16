// ── Media ─────────────────────────────────────────────────────────────────────

export interface PublicMediaAsset {
  id: string;
  url: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  dominantColor: string | null;
}

/** @deprecated Use PublicMediaAsset */
export type PublicMediaRef = PublicMediaAsset;

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

// ── Entity Types ──────────────────────────────────────────────────────────────

export interface PublicSlider {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  desktopMedia: PublicMediaAsset | null;
  mobileMedia: PublicMediaAsset | null;
  videoMedia: PublicMediaAsset | null;
  linkType: string;
  linkValue: string | null;
  buttonText: string | null;
  targetDevice: string;
  sortOrder: number;
  startAt: string | null;
  endAt: string | null;
}

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: PublicMediaAsset | null;
  startAt: string | null;
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
  coverMedia: PublicMediaAsset | null;
  startAt: string | null;
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

export interface PublicStore {
  id: string;
  mallId: string;
  name: string;
  description: string | null;
  floor: string | null;
  storeNo: string | null;
  phone: string | null;
  email: string | null;
  workingHoursJson: unknown;
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
  };
  /** Mall-specific categories (preferred). */
  categories: { id: string; name: string; slug: string }[];
  /** @deprecated Use categories[0]; kept for backward compatibility. */
  category: { id: string; name: string; slug: string } | null;
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
  movie: { id: string; title: string; slug: string; durationMinutes: number | null };
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
  defaultLocale: string | null;
  activeLocale: string | null;
  rtl: boolean;
}
