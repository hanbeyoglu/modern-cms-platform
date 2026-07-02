import type { CSSProperties } from 'react';
import { slugify } from '../lib/slugify';

type Props = {
  title: string;
  slug: string;
  useCustomSlug: boolean;
  /** Persisted slug on edit (shown when auto mode). */
  persistedSlug?: string;
  onUseCustomSlugChange: (useCustomSlug: boolean) => void;
  onSlugChange: (slug: string) => void;
  disabled?: boolean;
  labelStyle?: CSSProperties;
  inputStyle?: CSSProperties;
};

const defaultLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 3,
};

const defaultInputStyle: CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  boxSizing: 'border-box',
};

export function ContentSlugFields({
  title,
  slug,
  useCustomSlug,
  persistedSlug,
  onUseCustomSlugChange,
  onSlugChange,
  disabled,
  labelStyle = defaultLabelStyle,
  inputStyle = defaultInputStyle,
}: Props) {
  const autoPreview = slugify(title);
  const displaySlug = useCustomSlug ? slug : (persistedSlug || autoPreview);

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280', lineHeight: 1.45 }}>
        Slug başlıktan otomatik oluşturulur.
        {!useCustomSlug && displaySlug ? (
          <>
            {' '}
            <span style={{ fontFamily: 'monospace', color: '#374151' }}>{displaySlug}</span>
          </>
        ) : null}
      </p>
      <details style={{ fontSize: 13 }}>
        <summary style={{ cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, color: '#374151' }}>
          Gelişmiş ayarlar
        </summary>
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={useCustomSlug}
              disabled={disabled}
              onChange={(e) => onUseCustomSlugChange(e.target.checked)}
            />
            Özel slug kullan
          </label>
          {useCustomSlug ? (
            <div>
              <label style={labelStyle}>Slug</label>
              <input
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                value={slug}
                disabled={disabled}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder={autoPreview}
              />
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Slug (salt okunur)</label>
              <input
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  background: '#f3f4f6',
                  color: '#6b7280',
                }}
                value={displaySlug}
                readOnly
                tabIndex={-1}
              />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
