import { useState, type ReactNode } from 'react';
import type { CmsLocale } from '../lib/api';

/** Keep language-specific media beside the shared-cover switch, independently of text tabs. */
export function LocalizedCoverFields({ locales, disabled, renderFields }: {
  locales: CmsLocale[];
  disabled?: boolean;
  renderFields: (localeId: string) => ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeLocales = locales.filter(locale => locale.isActive);
  const selected = activeLocales.find(locale => locale.id === selectedId)
    ?? activeLocales.find(locale => locale.isDefault) ?? activeLocales[0];
  if (!selected) return <p role="status">Görsel dilleri yüklenemedi. Dil ayarlarını kontrol edip formu yeniden açın. Seçili görselleriniz korunur.</p>;
  return (
    <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
      <div role="group" aria-label="Kapak görseli dili" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {activeLocales.map(locale => (
          <button key={locale.id} type="button" disabled={disabled}
            aria-pressed={selected.id === locale.id} onClick={() => setSelectedId(locale.id)}
            style={{ padding: '8px 12px', borderRadius: 8, border: selected.id === locale.id ? '2px solid #2563eb' : '2px solid #e5e7eb', background: selected.id === locale.id ? '#eff6ff' : '#fff', color: '#1f2937', cursor: disabled ? 'not-allowed' : 'pointer', font: 'inherit', fontSize: 13 }}>
            {locale.code.toUpperCase()}{locale.isDefault ? ' · Varsayılan' : ''}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: '#4b5563' }}>
        {selected.code.toUpperCase()} kapak görseli{selected.isDefault ? ' — diğer diller için yedek olarak kullanılır.' : ' — boş bırakılırsa varsayılan dil veya ortak kapak kullanılır.'}
      </div>
      <div key={selected.id} style={{ minWidth: 0 }}>{renderFields(selected.id)}</div>
    </div>
  );
}
