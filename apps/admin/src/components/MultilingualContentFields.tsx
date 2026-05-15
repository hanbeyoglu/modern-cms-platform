import type { CSSProperties } from 'react';
import type { CmsLocale } from '../lib/api';

export const EVENT_I18N_FIELDS = ['title', 'shortDescription', 'description', 'buttonText'] as const;
export type EventI18nField = (typeof EVENT_I18N_FIELDS)[number];
export const CAMPAIGN_I18N_FIELDS = [
  'title',
  'shortDescription',
  'description',
  'terms',
  'buttonText',
] as const;
export type CampaignI18nField = (typeof CAMPAIGN_I18N_FIELDS)[number];
export const SLIDER_I18N_FIELDS = ['title', 'subtitle', 'description', 'buttonText'] as const;
export type SliderI18nField = (typeof SLIDER_I18N_FIELDS)[number];
export const PAGE_I18N_FIELDS = ['title', 'seoTitle', 'seoDescription'] as const;
export type PageI18nField = (typeof PAGE_I18N_FIELDS)[number];
export const LOCATION_I18N_FIELDS = ['displayName', 'shortDescription', 'description'] as const;
export type LocationI18nField = (typeof LOCATION_I18N_FIELDS)[number];
export const GLOBAL_STORE_I18N_FIELDS = ['name', 'description'] as const;
export type GlobalStoreI18nField = (typeof GLOBAL_STORE_I18N_FIELDS)[number];
export const MALL_STORE_I18N_FIELDS = ['localName', 'localDescription'] as const;
export type MallStoreI18nField = (typeof MALL_STORE_I18N_FIELDS)[number];
export type MultilingualContentField =
  | EventI18nField
  | CampaignI18nField
  | SliderI18nField
  | PageI18nField
  | LocationI18nField
  | GlobalStoreI18nField
  | MallStoreI18nField;

const LABELS: Record<MultilingualContentField, string> = {
  name: 'Ad',
  title: 'Başlık',
  displayName: 'Görünen Ad',
  localName: 'Yerel ad',
  subtitle: 'Alt Başlık',
  shortDescription: 'Kısa açıklama',
  description: 'Açıklama',
  localDescription: 'Yerel açıklama',
  terms: 'Şartlar',
  buttonText: 'Buton metni',
  seoTitle: 'SEO Başlığı',
  seoDescription: 'SEO Açıklaması',
};

function completionForLocale(
  loc: CmsLocale,
  defaultLocaleId: string | undefined,
  fields: readonly MultilingualContentField[],
  requiredField: MultilingualContentField | null | undefined,
  getValue: (localeId: string, field: MultilingualContentField) => string,
): { pct: number; tone: 'complete' | 'partial' | 'none' } {
  if (loc.id === defaultLocaleId) {
    const required = requiredField === undefined ? fields[0] : requiredField;
    if (required) {
      const req = getValue(loc.id, required).trim();
      return req ? { pct: 100, tone: 'complete' } : { pct: 0, tone: 'none' };
    }
    const filled = fields.filter((f) => getValue(loc.id, f).trim()).length;
    if (filled === 0) return { pct: 0, tone: 'none' };
    if (filled === fields.length) return { pct: 100, tone: 'complete' };
    return { pct: Math.round((filled / fields.length) * 100), tone: 'partial' };
  }
  let filled = 0;
  let needed = 0;
  for (const f of fields) {
    const base = getValue(defaultLocaleId ?? '', f).trim();
    if (!base) continue;
    needed += 1;
    if (getValue(loc.id, f).trim()) filled += 1;
  }
  if (needed === 0) return { pct: 100, tone: 'complete' };
  const pct = Math.round((filled / needed) * 100);
  if (filled === 0) return { pct: 0, tone: 'none' };
  if (filled === needed) return { pct: 100, tone: 'complete' };
  return { pct, tone: 'partial' };
}

const badgeStyle = (tone: 'complete' | 'partial' | 'none'): CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 4,
  color: '#fff',
  background: tone === 'complete' ? '#059669' : tone === 'partial' ? '#d97706' : '#9ca3af',
});

type Props = {
  locales: CmsLocale[];
  activeLocaleId: string;
  onTabChange: (id: string) => void;
  defaultLocaleId: string | undefined;
  fields?: readonly MultilingualContentField[];
  requiredField?: MultilingualContentField | null;
  getValue: (localeId: string, field: MultilingualContentField) => string;
  setValue: (localeId: string, field: MultilingualContentField, v: string) => void;
  onCopyFromDefault: (targetLocaleId: string) => void;
  disabled?: boolean;
};

export function MultilingualContentFields({
  locales,
  activeLocaleId,
  onTabChange,
  defaultLocaleId,
  fields = EVENT_I18N_FIELDS,
  requiredField,
  getValue,
  setValue,
  onCopyFromDefault,
  disabled,
}: Props) {
  const tabLocales = locales.filter((l) => l.isActive);
  if (tabLocales.length === 0) return null;

  const active = tabLocales.find((l) => l.id === activeLocaleId) ?? tabLocales[0];
  const isRtl = Boolean(active.rtl || active.code.toLowerCase() === 'ar');
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
    direction: isRtl ? 'rtl' : 'ltr',
    textAlign: isRtl ? 'right' : 'left',
  };
  const labelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 3,
  };

  return (
    <div style={{ marginTop: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#111827' }}>
        Çok dilli içerik
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {tabLocales.map((loc) => {
          const { pct, tone } = completionForLocale(loc, defaultLocaleId, fields, requiredField, getValue);
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => onTabChange(loc.id)}
              style={{
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: activeLocaleId === loc.id ? '2px solid #2563eb' : '1px solid #d1d5db',
                background: activeLocaleId === loc.id ? '#eff6ff' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontWeight: 700 }}>{loc.code.toUpperCase()}</span>
              {loc.isDefault && (
                <span style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 600 }}>varsayılan</span>
              )}
              {loc.rtl && (
                <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>RTL</span>
              )}
              <span style={badgeStyle(tone)}>{pct}%</span>
            </button>
          );
        })}
      </div>
      {defaultLocaleId && active.id !== defaultLocaleId && (
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCopyFromDefault(active.id)}
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            Varsayılan dil içeriğini bu dile kopyala
          </button>
        </div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {fields.map((field) => (
          <div key={field}>
            <label style={labelStyle}>
              {LABELS[field]}
              {field === (requiredField === undefined ? fields[0] : requiredField) &&
                active.id === defaultLocaleId &&
                ' *'}
            </label>
            {field === 'description' ||
            field === 'shortDescription' ||
            field === 'terms' ||
            field === 'seoDescription' ||
            field === 'localDescription' ? (
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: field === 'description' ? 88 : field === 'terms' || field === 'seoDescription' ? 64 : 52,
                  resize: 'vertical',
                }}
                value={getValue(active.id, field)}
                disabled={disabled}
                onChange={(e) => setValue(active.id, field, e.target.value)}
              />
            ) : (
              <input
                style={inputStyle}
                value={getValue(active.id, field)}
                disabled={disabled}
                onChange={(e) => setValue(active.id, field, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
