import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { useCapability } from '../../hooks/useCapability';
import {
  apiGlobalSearch,
  type GlobalSearchHit,
  type GlobalSearchResponse,
} from '../../lib/api/search';
import './global-search.css';

const GROUPS: Array<{ key: keyof GlobalSearchResponse; label: string }> = [
  { key: 'pages', label: 'Sayfalar' },
  { key: 'events', label: 'Etkinlikler' },
  { key: 'campaigns', label: 'Kampanyalar' },
  { key: 'stores', label: 'Mağazalar' },
  { key: 'movies', label: 'Filmler' },
  { key: 'cinemas', label: 'Sinemalar' },
  { key: 'sliders', label: 'Slaytlar' },
];
const LABELS: Record<GlobalSearchHit['entityType'], string> = {
  PAGE: 'Sayfa',
  EVENT: 'Etkinlik',
  CAMPAIGN: 'Kampanya',
  GLOBAL_STORE: 'Mağaza havuzu',
  MALL_STORE: 'AVM mağazası',
  MOVIE: 'Film',
  CINEMA: 'Sinema',
  SLIDER: 'Slayt',
};
const STATUS: Record<string, string> = {
  PUBLISHED: 'Yayında',
  DRAFT: 'Taslak',
  ARCHIVED: 'Arşivde',
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  SCHEDULED: 'Zamanlanmış',
  LIVE: 'Canlı',
};
type Result = { key: string; data?: GlobalSearchResponse; error?: boolean };

export function GlobalSearch({ variant = 'header' }: { variant?: 'header' | 'page' }) {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const { has } = useCapability();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const allowed = can('search:global') && has('search') && !!accessToken && !!activeTenantId;
  const query = q.trim();
  // Results are tied to the complete context, including token changes on re-login.
  const key = JSON.stringify([accessToken, activeTenantId, activeMallId, query, retry]);
  const current = result?.key === key ? result : null;
  const isPage = variant === 'page';
  const loading = query.length > 0 && !current;

  useEffect(() => {
    if (!allowed || !query) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void apiGlobalSearch(accessToken!, activeTenantId!, activeMallId ?? undefined, {
        q: query,
        limit: isPage ? 20 : 6,
      })
        .then((data) => {
          if (!cancelled) setResult({ key, data });
        })
        .catch(() => {
          if (!cancelled) setResult({ key, error: true });
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allowed, accessToken, activeTenantId, activeMallId, query, key, isPage]);

  useEffect(() => {
    setOpen(false);
    setQ(isPage ? (new URLSearchParams(location.search).get('q') ?? '').slice(0, 200) : '');
    setResult(null);
  }, [location.pathname, location.search, activeTenantId, activeMallId, isPage]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      // Header search is hidden on phones and duplicated on the search page.
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        inputRef.current?.getClientRects().length
      ) {
        if (variant === 'header' && location.pathname === '/search') return;
        event.preventDefault();
        inputRef.current.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [location.pathname, variant]);

  if (!allowed) return null;
  const groups = GROUPS.map((group) => ({ ...group, hits: current?.data?.[group.key] ?? [] }));
  const count = groups.reduce((sum, group) => sum + group.hits.length, 0);
  const show = (isPage || open) && !!query;
  return (
    <div
      ref={wrapRef}
      className={`cms-global-search ${isPage ? 'cms-global-search--page' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="cms-global-search__input">
        <span aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          maxLength={200}
          placeholder="İçerik veya mağaza ara…"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Genel arama"
          aria-controls={show ? panelId : undefined}
          aria-expanded={show}
        />
        {!q && <kbd aria-hidden="true">⌘K / Ctrl+K</kbd>}
      </div>
      {isPage && !query && (
        <p className="cms-global-search__hint">
          Başlık veya mağaza adı yazarak başlayın. Yalnızca erişiminiz olan kayıtlar aranır.
        </p>
      )}
      {show && (
        <section
          id={panelId}
          aria-label="Arama sonuçları"
          aria-busy={loading}
          className="cms-global-search__panel"
        >
          <div role="status" aria-live="polite" className="cms-global-search__summary">
            {loading
              ? 'Aranıyor…'
              : current?.error
                ? 'Arama tamamlanamadı.'
                : `${count} sonuç · Seçili çalışma alanı`}
          </div>
          {current?.error && (
            <div className="cms-global-search__message" role="alert">
              Arama sonuçlarına ulaşılamadı. Bağlantınızı ve arama özelliğinin etkin olduğunu
              kontrol edin.
              <button type="button" onClick={() => setRetry((value) => value + 1)}>
                Tekrar dene
              </button>
            </div>
          )}
          {!loading && !current?.error && !count && (
            <div className="cms-global-search__message">
              “{query}” için sonuç bulunamadı. Farklı bir ad veya kelime deneyin.
            </div>
          )}
          {!loading &&
            !current?.error &&
            groups.map(
              ({ key: groupKey, label, hits }) =>
                hits.length > 0 && (
                  <div key={groupKey} className="cms-global-search__group">
                    <h3>
                      {label}
                      <span>{hits.length}</span>
                    </h3>
                    <ul>
                      {hits.map((hit) => (
                        <li key={`${hit.entityType}:${hit.id}`}>
                          <Link
                            to={hit.url}
                            onClick={() => {
                              setOpen(false);
                              setQ('');
                            }}
                          >
                            <span className="cms-global-search__title">{hit.title}</span>
                            <span className="cms-global-search__meta">
                              {LABELS[hit.entityType]}
                              {hit.mallName ? ` · ${hit.mallName}` : ''}
                              {STATUS[hit.status] ? ` · ${STATUS[hit.status]}` : ''}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          {!loading && !current?.error && count > 0 && (
            <div className="cms-global-search__footer">
              {isPage ? (
                'Her tür için en fazla 20 sonuç gösterilir. Daha kesin sonuç için aramanızı daraltın.'
              ) : (
                <Link to={`/search?q=${encodeURIComponent(query)}`}>Tüm sonuçları göster →</Link>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
