/** Official catalog for seeding / create-defaults (Sprint 21). */
export const OFFICIAL_SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe', nativeName: 'Türkçe', rtl: false },
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', rtl: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', rtl: false },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文', rtl: false },
] as const;

/** Normalize query/header and stored language codes consistently. */
export function normalizeLanguageCode(code: string): string {
  return code.trim().toLowerCase().replace(/_/g, '-');
}

/** Known language directions cannot be accidentally overridden by a false checkbox. */
export function localeDirection(code: string): boolean | undefined {
  const parts = normalizeLanguageCode(code).split('-');
  if (parts.includes('latn')) return false;
  if (parts.includes('arab') || parts.includes('hebr')) return true;
  if (['ar', 'fa', 'he', 'ur', 'ps', 'dv', 'yi', 'ug', 'sd'].includes(parts[0]!)) return true;
  if (OFFICIAL_SUPPORTED_LANGUAGES.some(l => l.code === parts[0]) || parts[0] === 'ja') return false;
  return undefined;
}

export function rtlForLocaleCode(code: string): boolean {
  return localeDirection(code) ?? false;
}

export function withLocaleDirection<T extends { code: string; rtl: boolean }>(locale: T): T {
  return { ...locale, rtl: localeDirection(locale.code) ?? locale.rtl };
}
