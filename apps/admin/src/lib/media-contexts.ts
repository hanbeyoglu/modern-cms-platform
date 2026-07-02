export type MediaUsageContextKey =
  | 'HOMEPAGE_HERO'
  | 'SLIDER_DESKTOP'
  | 'SLIDER_MOBILE'
  | 'SLIDER_KIOSK'
  | 'EVENT_COVER'
  | 'CAMPAIGN_COVER'
  | 'CAMPAIGN_MOBILE_COVER'
  | 'POPUP_IMAGE'
  | 'MOVIE_POSTER'
  | 'STORE_LOGO'
  | 'LOCATION_LOGO'
  | 'LOCATION_COVER'
  | 'SERVICE_ICON'
  | 'SERVICE_COVER';

export interface MediaContextPreset {
  key: MediaUsageContextKey;
  label: string;
  recommendedWidth: number;
  recommendedHeight: number;
  acceptedMime: string;
  helperText?: string | null;
  aspectRatioLocked?: boolean;
}

export const MEDIA_CONTEXTS: Record<MediaUsageContextKey, MediaContextPreset> = {
  HOMEPAGE_HERO: {
    key: 'HOMEPAGE_HERO',
    label: 'Ana Sayfa Hero',
    recommendedWidth: 1920,
    recommendedHeight: 800,
    acceptedMime: 'image/*',
  },
  SLIDER_DESKTOP: {
    key: 'SLIDER_DESKTOP',
    label: 'Slider Web Görseli',
    recommendedWidth: 1920,
    recommendedHeight: 720,
    acceptedMime: 'image/*',
  },
  SLIDER_MOBILE: {
    key: 'SLIDER_MOBILE',
    label: 'Slider Mobil Görseli',
    recommendedWidth: 768,
    recommendedHeight: 1024,
    acceptedMime: 'image/*',
  },
  SLIDER_KIOSK: {
    key: 'SLIDER_KIOSK',
    label: 'Slider Kiosk Görseli',
    recommendedWidth: 1080,
    recommendedHeight: 1920,
    acceptedMime: 'image/*',
  },
  EVENT_COVER: {
    key: 'EVENT_COVER',
    label: 'Etkinlik Kapak Görseli',
    recommendedWidth: 1200,
    recommendedHeight: 630,
    acceptedMime: 'image/*',
  },
  CAMPAIGN_COVER: {
    key: 'CAMPAIGN_COVER',
    label: 'Kampanya Kapak Görseli',
    recommendedWidth: 1200,
    recommendedHeight: 630,
    acceptedMime: 'image/*',
  },
  CAMPAIGN_MOBILE_COVER: {
    key: 'CAMPAIGN_MOBILE_COVER',
    label: 'Kampanya Mobil Kapak Görseli',
    recommendedWidth: 768,
    recommendedHeight: 1024,
    acceptedMime: 'image/*',
  },
  POPUP_IMAGE: {
    key: 'POPUP_IMAGE',
    label: 'Popup Görseli',
    recommendedWidth: 800,
    recommendedHeight: 800,
    acceptedMime: 'image/*',
  },
  MOVIE_POSTER: {
    key: 'MOVIE_POSTER',
    label: 'Film Afişi',
    recommendedWidth: 600,
    recommendedHeight: 900,
    acceptedMime: 'image/*',
  },
  STORE_LOGO: {
    key: 'STORE_LOGO',
    label: 'Mağaza Logosu',
    recommendedWidth: 512,
    recommendedHeight: 512,
    acceptedMime: 'image/*',
  },
  LOCATION_LOGO: {
    key: 'LOCATION_LOGO',
    label: 'Lokasyon Logosu',
    recommendedWidth: 512,
    recommendedHeight: 512,
    acceptedMime: 'image/*',
  },
  LOCATION_COVER: {
    key: 'LOCATION_COVER',
    label: 'Lokasyon Kapak Görseli',
    recommendedWidth: 1600,
    recommendedHeight: 600,
    acceptedMime: 'image/*',
  },
  SERVICE_ICON: {
    key: 'SERVICE_ICON',
    label: 'Hizmet İkonu',
    recommendedWidth: 256,
    recommendedHeight: 256,
    acceptedMime: 'image/*',
  },
  SERVICE_COVER: {
    key: 'SERVICE_COVER',
    label: 'Hizmet Kapak Görseli',
    recommendedWidth: 1200,
    recommendedHeight: 630,
    acceptedMime: 'image/*',
  },
};
