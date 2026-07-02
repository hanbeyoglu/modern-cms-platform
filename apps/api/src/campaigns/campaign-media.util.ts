export type CampaignMediaRow = {
  id: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
} | null;

export type CampaignTranslationMediaRow = {
  localeId: string;
  title: string | null;
  description: string | null;
  buttonText: string | null;
  coverImage: CampaignMediaRow;
  mobileCoverImage: CampaignMediaRow;
};

export function resolveCampaignMedia(opts: {
  sameImageForAllLocales: boolean;
  sharedCoverImage: CampaignMediaRow;
  sharedMobileCoverImage: CampaignMediaRow;
  localeId: string;
  defaultLocaleId: string | null;
  translations: CampaignTranslationMediaRow[];
}): { desktop: CampaignMediaRow; mobile: CampaignMediaRow } {
  if (opts.sameImageForAllLocales) {
    return {
      desktop: opts.sharedCoverImage,
      mobile: opts.sharedMobileCoverImage ?? opts.sharedCoverImage,
    };
  }

  const byLocale = new Map(opts.translations.map((t) => [t.localeId, t]));
  const localeTr = byLocale.get(opts.localeId);
  const defaultTr = opts.defaultLocaleId ? byLocale.get(opts.defaultLocaleId) : undefined;

  const desktop = localeTr?.coverImage ?? defaultTr?.coverImage ?? opts.sharedCoverImage;
  const mobile =
    localeTr?.mobileCoverImage ??
    defaultTr?.mobileCoverImage ??
    opts.sharedMobileCoverImage ??
    desktop;

  return { desktop, mobile };
}
