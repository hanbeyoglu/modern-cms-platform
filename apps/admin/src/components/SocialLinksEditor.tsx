import {
  STORE_SOCIAL_PLATFORMS,
  STORE_SOCIAL_PLATFORM_LABELS,
  type StoreSocialLink,
  type StoreSocialPlatform,
} from '../lib/store-social-links';

type Props = {
  value: StoreSocialLink[];
  onChange: (value: StoreSocialLink[]) => void;
  disabled?: boolean;
};

export function SocialLinksEditor({ value, onChange, disabled }: Props) {
  function updateRow(index: number, patch: Partial<StoreSocialLink>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    const used = new Set(value.map((v) => v.platform));
    const nextPlatform =
      STORE_SOCIAL_PLATFORMS.find((p) => p === 'OTHER' || !used.has(p)) ?? 'OTHER';
    onChange([...value, { platform: nextPlatform, url: '' }]);
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Web ve Sosyal Medya</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {value.map((row, index) => (
          <div key={`${row.platform}-${index}`} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 8 }}>
            <select
              value={row.platform}
              disabled={disabled}
              onChange={(e) => updateRow(index, { platform: e.target.value as StoreSocialPlatform })}
              style={{ padding: 6 }}
            >
              {STORE_SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {STORE_SOCIAL_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
            <input
              type="url"
              value={row.url}
              disabled={disabled}
              onChange={(e) => updateRow(index, { url: e.target.value })}
              placeholder="https://..."
              style={{ padding: 6 }}
            />
            <button type="button" disabled={disabled} onClick={() => removeRow(index)}>
              Kaldır
            </button>
          </div>
        ))}
      </div>
      <button type="button" disabled={disabled} onClick={addRow} style={{ marginTop: 8 }}>
        + Sosyal medya hesabı ekle
      </button>
    </div>
  );
}
