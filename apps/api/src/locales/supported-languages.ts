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

export function rtlForLocaleCode(code: string): boolean {
  const c = code.toLowerCase().trim();
  const hit = OFFICIAL_SUPPORTED_LANGUAGES.find((l) => l.code === c);
  return hit?.rtl ?? c === 'ar';
}
