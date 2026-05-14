export interface PublicMediaRef {
  url: string;
  altText: string | null;
}

export interface PublicSlider {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  desktopMedia: PublicMediaRef | null;
  mobileMedia: PublicMediaRef | null;
  videoMedia: { url: string } | null;
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
  coverMedia: PublicMediaRef | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  category: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: string | null;
}

export interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverMedia: PublicMediaRef | null;
  startAt: string | null;
  endAt: string | null;
  terms: string | null;
  couponCode: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  sortOrder: number;
  publishedAt: string | null;
  store: { id: string; name: string; slug: string } | null;
}

export interface PublicPageBlock {
  id: string;
  type: string;
  title: string | null;
  dataJson: unknown;
  sortOrder: number;
}

export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  type: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishedAt: string | null;
  blocks: PublicPageBlock[];
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
  sortOrder: number;
  logo: { url: string } | null;
  globalStore: {
    id: string;
    name: string;
    slug: string;
    websiteUrl: string | null;
  };
  category: { id: string; name: string; slug: string } | null;
}

export interface PublicCinema {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: { url: string } | null;
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
  logo: { url: string } | null;
  cover: { url: string } | null;
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
  /** Enabled tenant locales for public language switchers (Sprint 21). */
  supportedLocales: PublicSiteSupportedLocale[];
  defaultLocale: string | null;
  activeLocale: string | null;
  rtl: boolean;
}
