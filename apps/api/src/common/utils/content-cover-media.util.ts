export type CoverMediaRow = {
  id: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
} | null;

export type ContentTranslationRow = {
  localeId: string;
  title: string | null;
  description: string | null;
  buttonText?: string | null;
  shortDescription?: string | null;
  coverImage: CoverMediaRow;
};

export function resolveContentCoverImage(opts: {
  sameImageForAllLocales: boolean;
  sharedCoverImage: CoverMediaRow;
  localeId: string;
  defaultLocaleId: string | null;
  translations: ContentTranslationRow[];
}): CoverMediaRow {
  if (opts.sameImageForAllLocales) {
    return opts.sharedCoverImage;
  }

  const byLocale = new Map(opts.translations.map((t) => [t.localeId, t]));
  const localeTr = byLocale.get(opts.localeId);
  const defaultTr = opts.defaultLocaleId ? byLocale.get(opts.defaultLocaleId) : undefined;

  return localeTr?.coverImage ?? defaultTr?.coverImage ?? opts.sharedCoverImage;
}

export function pickLocalizedField(
  field: 'title' | 'description' | 'shortDescription' | 'buttonText',
  base: string | null,
  localeId: string,
  defaultLocaleId: string | null,
  translations: ContentTranslationRow[],
  localizedContent?: Record<string, string>,
): string | null {
  const byLocale = new Map(translations.map((t) => [t.localeId, t]));
  const localeTr = byLocale.get(localeId);
  const defaultTr = defaultLocaleId ? byLocale.get(defaultLocaleId) : undefined;

  const fromLocale = localeTr?.[field];
  if (fromLocale != null && fromLocale !== '') return fromLocale;
  if (localizedContent?.[field]) return localizedContent[field];
  const fromDefault = defaultTr?.[field];
  if (fromDefault != null && fromDefault !== '') return fromDefault;
  return base;
}
