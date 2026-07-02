import { validatePageSchedule } from './publishing-workflow';

export function getCampaignSaveBlocker(opts: {
  title: string;
  status: string;
  publishStartAt: string;
  campaignStartAt: string;
  sameImageForAllLocales: boolean;
  sharedCoverImageId: string;
  defaultLocaleCoverImageId?: string;
}): string | null {
  if (!opts.title.trim()) return 'Başlık zorunludur.';
  const scheduleError = validatePageSchedule(
    opts.status as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED',
    opts.publishStartAt,
  );
  if (scheduleError) return scheduleError;
  if (opts.status === 'PUBLISHED' && !opts.campaignStartAt.trim()) {
    return 'Yayınlanan kampanyalar için kampanya başlangıç tarihi zorunludur.';
  }
  if (opts.status === 'PUBLISHED') {
    if (opts.sameImageForAllLocales && !opts.sharedCoverImageId) {
      return 'Yayınlanan kampanyalar için kapak görseli zorunludur.';
    }
    if (!opts.sameImageForAllLocales && !opts.defaultLocaleCoverImageId && !opts.sharedCoverImageId) {
      return 'Varsayılan dil için kapak görseli zorunludur.';
    }
  }
  return null;
}

export function getEventSaveBlocker(opts: {
  title: string;
  status: string;
  publishStartAt: string;
  eventStartAt: string;
  sameImageForAllLocales: boolean;
  sharedCoverImageId: string;
  defaultLocaleCoverImageId?: string;
}): string | null {
  if (!opts.title.trim()) return 'Başlık zorunludur.';
  const scheduleError = validatePageSchedule(
    opts.status as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED',
    opts.publishStartAt,
  );
  if (scheduleError) return scheduleError;
  if (opts.status === 'PUBLISHED' && !opts.eventStartAt.trim()) {
    return 'Yayınlanan etkinlikler için etkinlik başlangıç tarihi zorunludur.';
  }
  if (opts.status === 'PUBLISHED') {
    if (opts.sameImageForAllLocales && !opts.sharedCoverImageId) {
      return 'Yayınlanan etkinlikler için kapak görseli zorunludur.';
    }
    if (!opts.sameImageForAllLocales && !opts.defaultLocaleCoverImageId && !opts.sharedCoverImageId) {
      return 'Varsayılan dil için kapak görseli zorunludur.';
    }
  }
  return null;
}

export function buildCampaignTranslationsPayload(
  tenantLocales: Array<{ id: string; isDefault: boolean; isActive: boolean }>,
  localeDrafts: Record<string, Record<string, string>>,
  opts?: {
    sameImageForAllLocales?: boolean;
    defaultLocaleCoverImageId?: string;
    defaultLocaleMobileCoverImageId?: string;
  },
): Array<{
  localeId: string;
  title?: string;
  description?: string;
  buttonText?: string;
  coverImageId?: string;
  mobileCoverImageId?: string;
}> {
  const defaultLocale = tenantLocales.find((l) => l.isDefault);
  const result: Array<{
    localeId: string;
    title?: string;
    description?: string;
    buttonText?: string;
    coverImageId?: string;
    mobileCoverImageId?: string;
  }> = [];

  if (opts?.sameImageForAllLocales === false && defaultLocale) {
    const defaultCover = opts.defaultLocaleCoverImageId?.trim();
    const defaultMobile = opts.defaultLocaleMobileCoverImageId?.trim();
    if (defaultCover || defaultMobile) {
      result.push({
        localeId: defaultLocale.id,
        coverImageId: defaultCover || undefined,
        mobileCoverImageId: defaultMobile || undefined,
      });
    }
  }

  for (const loc of tenantLocales.filter((l) => l.isActive)) {
    if (defaultLocale && loc.id === defaultLocale.id) continue;
    const slice = localeDrafts[loc.id];
    if (!slice) continue;
    const hasText = slice.title || slice.description || slice.buttonText;
    const coverImageId = slice.coverImageId || undefined;
    const mobileCoverImageId = slice.mobileCoverImageId || undefined;
    if (!hasText && !coverImageId && !mobileCoverImageId) continue;
    result.push({
      localeId: loc.id,
      title: slice.title || undefined,
      description: slice.description || undefined,
      buttonText: slice.buttonText || undefined,
      coverImageId,
      mobileCoverImageId,
    });
  }
  return result;
}

export function buildEventTranslationsPayload(
  tenantLocales: Array<{ id: string; isDefault: boolean; isActive: boolean }>,
  localeDrafts: Record<string, Record<string, string>>,
  opts?: {
    sameImageForAllLocales?: boolean;
    defaultLocaleCoverImageId?: string;
  },
): Array<{
  localeId: string;
  title?: string;
  description?: string;
  shortDescription?: string;
  coverImageId?: string;
}> {
  const defaultLocale = tenantLocales.find((l) => l.isDefault);
  const result: Array<{
    localeId: string;
    title?: string;
    description?: string;
    shortDescription?: string;
    coverImageId?: string;
  }> = [];

  if (opts?.sameImageForAllLocales === false && defaultLocale) {
    const defaultCover = opts.defaultLocaleCoverImageId?.trim();
    if (defaultCover) {
      result.push({
        localeId: defaultLocale.id,
        coverImageId: defaultCover,
      });
    }
  }

  for (const loc of tenantLocales.filter((l) => l.isActive)) {
    if (defaultLocale && loc.id === defaultLocale.id) continue;
    const slice = localeDrafts[loc.id];
    if (!slice) continue;
    const hasText = slice.title || slice.description || slice.shortDescription;
    const coverImageId = slice.coverImageId || undefined;
    if (!hasText && !coverImageId) continue;
    result.push({
      localeId: loc.id,
      title: slice.title || undefined,
      description: slice.description || undefined,
      shortDescription: slice.shortDescription || undefined,
      coverImageId: coverImageId || undefined,
    });
  }
  return result;
}
