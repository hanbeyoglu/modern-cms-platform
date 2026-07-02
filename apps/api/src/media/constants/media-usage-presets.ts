export const MEDIA_USAGE_KEYS = [
  'HOMEPAGE_HERO',
  'SLIDER_DESKTOP',
  'SLIDER_MOBILE',
  'SLIDER_KIOSK',
  'EVENT_COVER',
  'CAMPAIGN_COVER',
  'CAMPAIGN_MOBILE_COVER',
  'POPUP_IMAGE',
  'MOVIE_POSTER',
  'STORE_LOGO',
  'LOCATION_LOGO',
  'LOCATION_COVER',
  'SERVICE_ICON',
  'SERVICE_COVER',
] as const;

export type MediaUsageKey = (typeof MEDIA_USAGE_KEYS)[number];

export interface MediaUsagePreset {
  usageKey: MediaUsageKey;
  label: string;
  recommendedWidth: number;
  recommendedHeight: number;
  acceptedMimeTypes: string[];
  helperText: string | null;
  aspectRatioLocked: boolean;
}

export const DEFAULT_MEDIA_USAGE_PRESETS: Record<MediaUsageKey, MediaUsagePreset> = {
  HOMEPAGE_HERO: {
    usageKey: 'HOMEPAGE_HERO',
    label: 'Ana Sayfa Hero',
    recommendedWidth: 1920,
    recommendedHeight: 800,
    acceptedMimeTypes: ['image/*'],
    helperText: 'Ana sayfa üst banner görseli',
    aspectRatioLocked: true,
  },
  SLIDER_DESKTOP: {
    usageKey: 'SLIDER_DESKTOP',
    label: 'Slider Web Görseli',
    recommendedWidth: 1920,
    recommendedHeight: 720,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  SLIDER_MOBILE: {
    usageKey: 'SLIDER_MOBILE',
    label: 'Slider Mobil Görseli',
    recommendedWidth: 768,
    recommendedHeight: 1024,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  SLIDER_KIOSK: {
    usageKey: 'SLIDER_KIOSK',
    label: 'Slider Kiosk Görseli',
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  EVENT_COVER: {
    usageKey: 'EVENT_COVER',
    label: 'Etkinlik Kapak Görseli',
    recommendedWidth: 1200,
    recommendedHeight: 630,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  CAMPAIGN_COVER: {
    usageKey: 'CAMPAIGN_COVER',
    label: 'Kampanya Kapak Görseli',
    recommendedWidth: 1200,
    recommendedHeight: 630,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  CAMPAIGN_MOBILE_COVER: {
    usageKey: 'CAMPAIGN_MOBILE_COVER',
    label: 'Kampanya Mobil Kapak Görseli',
    recommendedWidth: 768,
    recommendedHeight: 1024,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  POPUP_IMAGE: {
    usageKey: 'POPUP_IMAGE',
    label: 'Popup Görseli',
    recommendedWidth: 800,
    recommendedHeight: 800,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  MOVIE_POSTER: {
    usageKey: 'MOVIE_POSTER',
    label: 'Film Afişi',
    recommendedWidth: 600,
    recommendedHeight: 900,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  STORE_LOGO: {
    usageKey: 'STORE_LOGO',
    label: 'Mağaza Logosu',
    recommendedWidth: 512,
    recommendedHeight: 512,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: true,
  },
  LOCATION_LOGO: {
    usageKey: 'LOCATION_LOGO',
    label: 'Lokasyon Logosu',
    recommendedWidth: 512,
    recommendedHeight: 512,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: true,
  },
  LOCATION_COVER: {
    usageKey: 'LOCATION_COVER',
    label: 'Lokasyon Kapak Görseli',
    recommendedWidth: 1600,
    recommendedHeight: 600,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
  SERVICE_ICON: {
    usageKey: 'SERVICE_ICON',
    label: 'Hizmet İkonu',
    recommendedWidth: 256,
    recommendedHeight: 256,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: true,
  },
  SERVICE_COVER: {
    usageKey: 'SERVICE_COVER',
    label: 'Hizmet Kapak Görseli',
    recommendedWidth: 1200,
    recommendedHeight: 630,
    acceptedMimeTypes: ['image/*'],
    helperText: null,
    aspectRatioLocked: false,
  },
};

export function isMediaUsageKey(key: string): key is MediaUsageKey {
  return (MEDIA_USAGE_KEYS as readonly string[]).includes(key);
}

export function formatAspectRatio(width: number, height: number): string {
  if (!width || !height) return '-';
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}
