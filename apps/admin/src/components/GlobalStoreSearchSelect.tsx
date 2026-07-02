import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlobalStore } from '../lib/api';

type Props = {
  stores: GlobalStore[];
  assignedGlobalStoreIds: string[];
  value: string;
  onChange: (globalStoreId: string) => void;
  disabled?: boolean;
};

export function GlobalStoreSearchSelect({
  stores,
  assignedGlobalStoreIds,
  value,
  onChange,
  disabled,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const available = useMemo(
    () => stores.filter((g) => !assignedGlobalStoreIds.includes(g.id)),
    [stores, assignedGlobalStoreIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q),
    );
  }, [available, query]);

  const selected = stores.find((g) => g.id === value) ?? null;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Global mağaza seç</label>
      <input
        type="search"
        placeholder="Mağaza adıyla ara…"
        value={open ? query : selected ? selected.name : query}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        style={{ display: 'block', width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            maxHeight: 280,
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}
        >
          {available.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>
              Bu AVM&apos;ye eklenebilecek yeni global mağaza kalmadı.
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>Sonuç bulunamadı.</div>
          ) : (
            filtered.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(g.id);
                  setQuery('');
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  padding: 10,
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  background: value === g.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                {g.logoMedia?.publicUrl ? (
                  <img src={g.logoMedia.publicUrl} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: 36, height: 36, background: '#f3f4f6', borderRadius: 4 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {g.slug}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
