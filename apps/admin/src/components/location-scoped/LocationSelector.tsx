import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth';

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
};

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
};

export function LocationSelector() {
  const { malls, activeMallId, selectMall, mallsLoading } = useAuth();
  const [query, setQuery] = useState('');

  const filteredMalls = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return malls;
    return malls.filter(
      (m) => m.name.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q),
    );
  }, [malls, query]);

  const activeMall = malls.find((m) => m.id === activeMallId);

  if (mallsLoading) {
    return (
      <div style={fieldStyle}>
        <span style={labelStyle}>Lokasyon</span>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Yükleniyor…</span>
      </div>
    );
  }

  if (malls.length === 0) {
    return (
      <div style={fieldStyle}>
        <span style={labelStyle}>Lokasyon</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Tanımlı lokasyon yok</span>
      </div>
    );
  }

  if (malls.length === 1) {
    return (
      <div style={fieldStyle}>
        <span style={labelStyle}>Lokasyon</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{malls[0]!.name}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ ...fieldStyle, minWidth: 160 }}>
        <span style={labelStyle}>Lokasyon ara</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad veya slug…"
          style={{ ...inputStyle, width: 180 }}
        />
      </label>
      <label style={{ ...fieldStyle, minWidth: 220 }}>
        <span style={labelStyle}>Lokasyon</span>
        <select
          value={activeMallId ?? ''}
          onChange={(e) => {
            selectMall(e.target.value || null);
            setQuery('');
          }}
          style={{ ...inputStyle, minWidth: 220 }}
        >
          <option value="">— Lokasyon seçin —</option>
          {filteredMalls.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {activeMall ? (
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 6 }}>{activeMall.slug}</span>
      ) : null}
    </div>
  );
}
