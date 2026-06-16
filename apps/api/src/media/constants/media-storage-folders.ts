export const MEDIA_STORAGE_FOLDERS = [
  'logos',
  'sliders',
  'campaigns',
  'events',
  'stores',
  'services',
  'pages',
] as const;

export type MediaStorageFolder = (typeof MEDIA_STORAGE_FOLDERS)[number];

const MEDIA_STORAGE_FOLDER_SET = new Set<string>(MEDIA_STORAGE_FOLDERS);

export const USAGE_CONTEXT_TO_STORAGE_FOLDER: Record<string, MediaStorageFolder> = {
  HOMEPAGE_HERO: 'sliders',
  SLIDER_DESKTOP: 'sliders',
  SLIDER_MOBILE: 'sliders',
  SLIDER_KIOSK: 'sliders',
  EVENT_COVER: 'events',
  CAMPAIGN_COVER: 'campaigns',
  POPUP_IMAGE: 'pages',
  MOVIE_POSTER: 'campaigns',
  STORE_LOGO: 'stores',
  LOCATION_LOGO: 'logos',
  LOCATION_COVER: 'logos',
  SERVICE_ICON: 'services',
  SERVICE_COVER: 'services',
};

export function resolveMediaStorageFolder(
  usageContext?: string | null,
  storageCategory?: string | null,
): MediaStorageFolder {
  if (storageCategory && MEDIA_STORAGE_FOLDER_SET.has(storageCategory)) {
    return storageCategory as MediaStorageFolder;
  }
  if (usageContext && USAGE_CONTEXT_TO_STORAGE_FOLDER[usageContext]) {
    return USAGE_CONTEXT_TO_STORAGE_FOLDER[usageContext];
  }
  return 'pages';
}
