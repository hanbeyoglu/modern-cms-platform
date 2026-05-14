import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { apiGlobalSearch, type GlobalSearchHit, type GlobalSearchResponse } from '../../lib/api/search';

const DEBOUNCE_MS = 320;

const GROUP_ORDER: Array<{ key: keyof GlobalSearchResponse; label: string }> = [
  { key: 'pages', label: 'Sayfalar' },
  { key: 'events', label: 'Etkinlikler' },
  { key: 'campaigns', label: 'Kampanyalar' },
  { key: 'stores', label: 'Mağazalar' },
  { key: 'movies', label: 'Filmler' },
  { key: 'cinemas', label: 'Sinemalar' },
  { key: 'sliders', label: 'Sliderlar' },
];

function entityBadge(t: GlobalSearchHit['entityType']): string {
  const m: Record<GlobalSearchHit['entityType'], string> = {
    PAGE: 'Sayfa',
    EVENT: 'Etkinlik',
    CAMPAIGN: 'Kampanya',
    GLOBAL_STORE: 'Global mağaza',
    MALL_STORE: 'AVM mağazası',
    MOVIE: 'Film',
    CINEMA: 'Sinema',
    SLIDER: 'Slider',
  };
  return m[t] ?? t;
}

type Props = { variant?: 'header' | 'page' };

export function GlobalSearch({ variant = 'header' }: Props) {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalSearchResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const allowed = can('search:global') && !!accessToken && !!activeTenantId;

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [q]);

  const fetchSearch = useCallback(async () => {
    if (!allowed || debounced.length < 1) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGlobalSearch(accessToken!, activeTenantId!, activeMallId ?? undefined, {
        q: debounced,
        limit: 6,
      });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Arama başarısız');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, accessToken, activeTenantId, activeMallId, debounced]);

  useEffect(() => {
    void fetchSearch();
  }, [fetchSearch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!allowed) return null;

  const isPage = variant === 'page';
  const showPanel = isPage ? debounced.length >= 1 : open && debounced.length >= 1;

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        flex: isPage ? '1 1 auto' : '1 1 280px',
        maxWidth: isPage ? 720 : 400,
        minWidth: isPage ? 280 : 200,
      }}
    >
      <input
        ref={inputRef}
        type="search"
        autoComplete="off"
        placeholder="Ara… (⌘K / Ctrl+K)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        aria-label="Genel arama"
        style={{
          width: '100%',
          height: 36,
          padding: '0 12px',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {showPanel && (
        <div
          style={{
            position: isPage ? 'relative' : 'absolute',
            left: 0,
            right: 0,
            top: isPage ? 12 : 40,
            marginTop: isPage ? 0 : 0,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: isPage ? 'none' : '0 8px 24px rgba(0,0,0,0.08)',
            maxHeight: isPage ? 'none' : 380,
            overflowY: isPage ? 'visible' : 'auto',
            zIndex: 50,
            padding: 12,
          }}
        >
          {loading && <div style={{ color: '#6b7280', fontSize: 13 }}>Aranıyor…</div>}
          {err && <div style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}
          {!loading && !err && debounced.length >= 1 && GROUP_ORDER.every(({ key }) => (data?.[key] ?? []).length === 0) && (
            <div style={{ color: '#6b7280', fontSize: 13 }}>Sonuç bulunamadı.</div>
          )}
          {!loading &&
            !err &&
            GROUP_ORDER.map(({ key, label }) => {
              const hits = data?.[key] ?? [];
              if (hits.length === 0) return null;
              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {hits.map((hit) => (
                      <li key={`${hit.entityType}:${hit.id}`} style={{ marginBottom: 4 }}>
                        <Link
                          to={hit.url}
                          onClick={() => {
                            setOpen(false);
                            setQ('');
                          }}
                          style={{
                            display: 'block',
                            padding: '8px 10px',
                            borderRadius: 6,
                            textDecoration: 'none',
                            color: '#111827',
                            fontSize: 13,
                            lineHeight: 1.35,
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{hit.title}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                            {entityBadge(hit.entityType)}
                            {hit.mallName ? ` · ${hit.mallName}` : ''}
                            <span style={{ marginLeft: 6, opacity: 0.7 }}>· skor {hit.score}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          {isPage && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
              Daha fazla sonuç için sorguyu daraltın veya ilgili modül listelerini kullanın.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
