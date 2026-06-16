export type SliderMediaRow = {
  id: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
} | null;

export type SliderItemTranslationRow = {
  localeId: string;
  title: string | null;
  description: string | null;
  buttonText: string | null;
  image: SliderMediaRow;
  mobileImage: SliderMediaRow;
};

export function resolveSliderItemMedia(opts: {
  sameImageForAllLocales: boolean;
  sharedImage: SliderMediaRow;
  sharedMobileImage: SliderMediaRow;
  localeId: string;
  defaultLocaleId: string | null;
  translations: SliderItemTranslationRow[];
}): { desktop: SliderMediaRow; mobile: SliderMediaRow } {
  if (opts.sameImageForAllLocales) {
    return {
      desktop: opts.sharedImage,
      mobile: opts.sharedMobileImage ?? opts.sharedImage,
    };
  }

  const byLocale = new Map(opts.translations.map((t) => [t.localeId, t]));
  const localeTr = byLocale.get(opts.localeId);
  const defaultTr = opts.defaultLocaleId ? byLocale.get(opts.defaultLocaleId) : undefined;

  const desktop = localeTr?.image ?? defaultTr?.image ?? opts.sharedImage;
  const mobile = localeTr?.mobileImage ?? defaultTr?.mobileImage ?? opts.sharedMobileImage ?? desktop;

  return { desktop, mobile };
}

export function resolveSliderItemText(opts: {
  baseTitle: string | null;
  baseDescription: string | null;
  baseButtonText: string | null;
  localeId: string;
  defaultLocaleId: string | null;
  translations: SliderItemTranslationRow[];
  localizedContent?: Record<string, string>;
}): { title: string | null; description: string | null; buttonText: string | null } {
  const byLocale = new Map(opts.translations.map((t) => [t.localeId, t]));
  const localeTr = byLocale.get(opts.localeId);
  const defaultTr = opts.defaultLocaleId ? byLocale.get(opts.defaultLocaleId) : undefined;
  const lc = opts.localizedContent ?? {};

  const pick = (field: 'title' | 'description' | 'buttonText', base: string | null): string | null => {
    const fromLocale = localeTr?.[field];
    if (fromLocale != null && fromLocale !== '') return fromLocale;
    if (lc[field]) return lc[field];
    const fromDefault = defaultTr?.[field];
    if (fromDefault != null && fromDefault !== '') return fromDefault;
    return base;
  };

  return {
    title: pick('title', opts.baseTitle),
    description: pick('description', opts.baseDescription),
    buttonText: pick('buttonText', opts.baseButtonText),
  };
}
