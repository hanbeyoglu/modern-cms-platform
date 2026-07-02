import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import {
  apiMovieGet,
  apiMovieSessionForMovieCreate,
  apiMovieSessionForMovieDelete,
  apiMovieSessionForMovieUpdate,
  apiMovieSessionsForMovieList,
  apiScreeningHallsList,
  tmdbPosterUrl,
  type CmsMovie,
  type CreateMovieSessionForMoviePayload,
  type MovieSessionRow,
  type MovieSessionStatus,
  type ScreeningHall,
} from '../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  'Türkçe Dublaj',
  'Türkçe Altyazı',
  'Orijinal',
  'Orijinal + Türkçe Altyazı',
  'İngilizce Dublaj',
  'İngilizce Altyazı',
];

const FORMAT_OPTIONS = ['2D', '3D', 'IMAX', 'IMAX 3D', '4DX', 'ScreenX', 'Dolby Atmos', 'VIP', 'Gold Class'];

const STATUS_CONFIG: Record<MovieSessionStatus, { bg: string; color: string; dot: string; label: string }> = {
  SCHEDULED: { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6', label: 'Planlı' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', label: 'İptal' },
  ARCHIVED: { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af', label: 'Arşiv' },
};

const MOVIE_STATUS_LABEL: Record<CmsMovie['status'], string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  ARCHIVED: 'Arşiv',
};

// ─── Form ─────────────────────────────────────────────────────────────────────

type FormState = {
  hallInput: string;
  showDate: string;
  showTime: string;
  language: string;
  formats: string[];
  status: MovieSessionStatus;
};

const EMPTY: FormState = {
  hallInput: '',
  showDate: '',
  showTime: '',
  language: '',
  formats: [],
  status: 'SCHEDULED',
};

function toForm(s: MovieSessionRow): FormState {
  return {
    hallInput: s.hall?.name ?? '',
    showDate: s.showDate ?? '',
    showTime: s.showTime ?? '',
    language: s.language ?? '',
    formats: s.format ? s.format.split(',').map((f) => f.trim()).filter(Boolean) : [],
    status: s.status,
  };
}

function toPayload(f: FormState, halls: ScreeningHall[]): CreateMovieSessionForMoviePayload {
  const hallName = f.hallInput.trim();
  const existing = halls.find(
    (h) => h.name.toLocaleLowerCase('tr-TR') === hallName.toLocaleLowerCase('tr-TR'),
  );
  return {
    ...(existing ? { hallId: existing.id } : hallName ? { hallName } : {}),
    showTime: f.showTime,
    showDate: f.showDate || undefined,
    language: f.language || undefined,
    format: f.formats.join(', ') || undefined,
    status: f.status,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(value?: string | null): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(value),
  );
}

function displayTime(s: MovieSessionRow): string {
  if (s.showTime) return s.showTime;
  if (s.startsAt) {
    return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(s.startsAt),
    );
  }
  return '—';
}

function displayDate(s: MovieSessionRow): string {
  if (s.showDate) return formatDate(s.showDate);
  if (s.startsAt) return formatDate(s.startsAt);
  return '—';
}

function displayHall(s: MovieSessionRow): string {
  if (s.hall?.name) return s.hall.name;
  if (s.cinema?.name) return s.cinema.name;
  if (s.hallName) return s.hallName;
  return '—';
}

function moviePoster(movie: CmsMovie): string | null {
  if (movie.posterMediaId && movie.posterMedia?.publicUrl) return movie.posterMedia.publicUrl;
  return tmdbPosterUrl(movie.posterPath);
}

// ─── Small components ─────────────────────────────────────────────────────────

function SessionStatusBadge({ status }: { status: MovieSessionStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 10,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconFilmEmpty() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </svg>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="session-icon-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 6,
        border: '1px solid transparent',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: danger ? '#dc2626' : '#6b7280',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ w, h, radius = 4 }: { w: number | string; h: number; radius?: number }) {
  return <div className="sess-skeleton" style={{ width: w, height: h, borderRadius: radius, flexShrink: 0 }} />;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
          <td style={{ padding: '12px 12px' }}><SkeletonBlock w={80} h={13} /></td>
          <td style={{ padding: '12px 12px' }}><SkeletonBlock w={72} h={13} /></td>
          <td style={{ padding: '12px 12px' }}><SkeletonBlock w={36} h={13} /></td>
          <td style={{ padding: '12px 12px' }}><SkeletonBlock w={100} h={13} /></td>
          <td style={{ padding: '12px 12px' }}><SkeletonBlock w={60} h={13} /></td>
          <td style={{ padding: '12px 12px' }}><SkeletonBlock w={52} h={22} radius={10} /></td>
          <td style={{ padding: '12px 12px' }}>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <SkeletonBlock w={30} h={30} radius={6} />
              <SkeletonBlock w={30} h={30} radius={6} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FORM_INPUT: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  background: '#fff',
};

const LABEL: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#374151' };

const SELECT_STYLE: CSSProperties = {
  fontSize: 13,
  padding: '0 10px',
  height: 34,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MovieSessionsPage() {
  const { movieId } = useParams();
  const { accessToken, activeTenantId, activeMallId } = useAuth();

  const tenantId = activeTenantId;
  const mallId = activeMallId ?? undefined;

  const [movie, setMovie] = useState<CmsMovie | null>(null);
  const [rows, setRows] = useState<MovieSessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [halls, setHalls] = useState<ScreeningHall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<MovieSessionStatus | ''>('');
  const [filterShowDate, setFilterShowDate] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MovieSessionRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Load refs ──────────────────────────────────────────────────────────────

  const loadRefs = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId || !movieId) return;
    try {
      const [movieRes, hallsRes] = await Promise.all([
        apiMovieGet(accessToken, tenantId, movieId),
        apiScreeningHallsList(accessToken, tenantId, mallId, { limit: 200 }),
      ]);
      setMovie(movieRes);
      setHalls(hallsRes.halls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veriler yüklenemedi');
    }
  }, [accessToken, tenantId, mallId, movieId]);

  // ── Load sessions ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId || !movieId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiMovieSessionsForMovieList(accessToken, tenantId, mallId, movieId, {
        status: filterStatus || undefined,
        showDate: filterShowDate || undefined,
        sortBy: 'showDate',
        limit: 100,
      });
      setRows(data.sessions);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seanslar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, movieId, filterStatus, filterShowDate]);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Guard conditions ───────────────────────────────────────────────────────

  if (!tenantId) {
    return (
      <PageContainer>
        <EmptyState title="Tenant seçilmedi" />
      </PageContainer>
    );
  }
  if (!mallId) {
    return (
      <PageContainer>
        <EmptyState title="AVM seçilmedi" description="Seanslar AVM kapsamlıdır." />
      </PageContainer>
    );
  }
  if (!movieId) {
    return (
      <PageContainer>
        <EmptyState title="Film seçilmedi" description="Filmler listesinden bir film seçin." />
      </PageContainer>
    );
  }

  const posterUrl = movie ? moviePoster(movie) : null;
  const normalizedHallInput = form.hallInput.trim().toLocaleLowerCase('tr-TR');
  const hallExists = Boolean(
    normalizedHallInput &&
      halls.some((h) => h.name.toLocaleLowerCase('tr-TR') === normalizedHallInput),
  );

  const hasFilters = !!(filterStatus || filterShowDate);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <style>{`
        @keyframes sess-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        .sess-skeleton { background: #e5e7eb; animation: sess-pulse 1.6s ease-in-out infinite; }
        .session-icon-btn:hover:not(:disabled) { background: #f3f4f6 !important; color: #374151 !important; border-color: #e5e7eb !important; }
        .session-row:hover { background: #f8fafc; }
        .session-filter-input:focus { outline: none; border-color: #2563eb !important; box-shadow: 0 0 0 2px rgba(37,99,235,0.12); }
      `}</style>

      {/* ── Breadcrumb ── */}
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link to="/movies" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
          Filmler
        </Link>
        <span>/</span>
        <span style={{ color: '#374151', fontWeight: 500 }}>{movie?.title ?? '…'}</span>
        <span>/</span>
        <span>Seanslar</span>
      </div>

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Seanslar</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#9ca3af' }}>
            AVM bazında gösterim programı
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setFormError(null);
            setShowForm(true);
          }}
        >
          + Yeni Seans
        </Button>
      </div>

      {/* ── Movie summary card ── */}
      {movie && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            padding: '14px 16px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            background: '#fff',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 60,
              height: 90,
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: '#f3f4f6',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }}
              />
            ) : (
              <span style={{ color: '#9ca3af', fontSize: 9, fontWeight: 700 }}>POSTER<br />YOK</span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{movie.title}</div>
            {movie.originalTitle && (
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{movie.originalTitle}</div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                marginTop: 10,
                fontSize: 12,
                color: '#6b7280',
              }}
            >
              {movie.releaseDate && (
                <span>
                  Vizyon:{' '}
                  <strong style={{ color: '#374151' }}>{formatDate(movie.releaseDate)}</strong>
                </span>
              )}
              {movie.durationMinutes != null && (
                <span>
                  Süre:{' '}
                  <strong style={{ color: '#374151' }}>{movie.durationMinutes} dk</strong>
                </span>
              )}
              {movie.tmdbVoteAverage != null && (
                <span>⭐ {movie.tmdbVoteAverage.toFixed(1)}</span>
              )}
              {movie.categories.length > 0 && (
                <span>
                  {movie.categories
                    .slice(0, 3)
                    .map((c) => c.category.name)
                    .join(', ')}
                </span>
              )}
              <span
                style={{
                  background: '#f3f4f6',
                  borderRadius: 4,
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#6b7280',
                }}
              >
                {MOVIE_STATUS_LABEL[movie.status]}
              </span>
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#9ca3af',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 14px',
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {total}
            </div>
            <div>seans</div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 16,
          padding: '10px 12px',
          background: '#f9fafb',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
        }}
      >
        {/* Date filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Gösterim Tarihi</span>
          <input
            type="date"
            value={filterShowDate}
            onChange={(e) => setFilterShowDate(e.target.value)}
            className="session-filter-input"
            style={{ ...SELECT_STYLE, height: 34, paddingLeft: 10, paddingRight: 10 }}
          />
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as MovieSessionStatus | '')}
          className="session-filter-input"
          style={SELECT_STYLE}
        >
          <option value="">Tüm Durumlar</option>
          <option value="SCHEDULED">Planlı</option>
          <option value="CANCELLED">İptal</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>

        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Uygula
        </Button>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterShowDate('');
              setFilterStatus('');
            }}
          >
            × Temizle
          </Button>
        )}
      </div>

      {/* ── Error ── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Table ── */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              {(['Salon', 'Gösterim Tarihi', 'Saat', 'Dil', 'Format', 'Durum'] as const).map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
              <th
                style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  textAlign: 'right',
                }}
              >
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '56px 24px',
                      gap: 12,
                    }}
                  >
                    <IconFilmEmpty />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: 15 }}>
                        {hasFilters ? 'Filtre sonucu bulunamadı' : 'Henüz seans oluşturulmadı'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
                        {hasFilters
                          ? 'Farklı filtreler deneyin veya tarihi temizleyin.'
                          : 'Bu film için ilk seans gösterimini oluşturun.'}
                      </p>
                    </div>
                    {!hasFilters && (
                      <Button
                        variant="primary"
                        onClick={() => {
                          setEditing(null);
                          setForm(EMPTY);
                          setFormError(null);
                          setShowForm(true);
                        }}
                      >
                        + İlk Seansı Oluştur
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr
                  key={s.id}
                  className="session-row"
                  style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s' }}
                >
                  {/* Salon */}
                  <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 500, color: '#374151' }}>
                    {displayHall(s) !== '—' ? (
                      displayHall(s)
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 12, fontStyle: 'italic' }}>
                        Salon belirlenmedi
                      </span>
                    )}
                  </td>

                  {/* Gösterim Tarihi */}
                  <td style={{ padding: '12px 12px', fontSize: 13, color: '#374151' }}>
                    {displayDate(s) !== '—' ? (
                      displayDate(s)
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 12, fontStyle: 'italic' }}>
                        Tarih belirlenmedi
                      </span>
                    )}
                  </td>

                  {/* Saat */}
                  <td style={{ padding: '12px 12px' }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#111827',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {displayTime(s)}
                    </span>
                    {s.endsAt && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        ↳{' '}
                        {new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(
                          new Date(s.endsAt),
                        )}
                      </div>
                    )}
                  </td>

                  {/* Dil */}
                  <td style={{ padding: '12px 12px', fontSize: 13, color: '#6b7280' }}>
                    {s.language || (
                      <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {/* Format */}
                  <td style={{ padding: '12px 12px' }}>
                    {s.format ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {s.format.split(',').map((f) => (
                          <span
                            key={f.trim()}
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: '#f3f4f6',
                              color: '#374151',
                              border: '1px solid #e5e7eb',
                            }}
                          >
                            {f.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {/* Durum */}
                  <td style={{ padding: '12px 12px' }}>
                    <SessionStatusBadge status={s.status} />
                  </td>

                  {/* İşlemler */}
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <IconBtn
                        label="Düzenle"
                        onClick={() => {
                          setEditing(s);
                          setForm(toForm(s));
                          setFormError(null);
                          setShowForm(true);
                        }}
                      >
                        <IconPencil />
                      </IconBtn>
                      <IconBtn
                        label="Sil"
                        danger
                        onClick={async () => {
                          if (!accessToken || !window.confirm('Bu seans silinsin mi?')) return;
                          try {
                            await apiMovieSessionForMovieDelete(
                              accessToken,
                              tenantId,
                              mallId,
                              movieId,
                              s.id,
                            );
                            setRows((prev) => prev.filter((x) => x.id !== s.id));
                            setTotal((t) => t - 1);
                            toast.success('Seans silindi');
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Silme hatası');
                          }
                        }}
                      >
                        <IconTrash />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Session form modal ── */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              maxWidth: 500,
              width: '100%',
              padding: '24px 24px 20px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  {editing ? 'Seans Düzenle' : 'Yeni Seans'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  {movie?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Kapat"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  fontSize: 20,
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>

            {formError && <ErrorBanner message={formError} />}

            {/* ── Gösterim Saati (ZORUNLU) ── */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>
                Gösterim Saati{' '}
                <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
              </label>
              <input
                type="time"
                style={{ ...FORM_INPUT, fontSize: 18, fontWeight: 600 }}
                value={form.showTime}
                onChange={(e) => setForm({ ...form, showTime: e.target.value })}
                required
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                Tek zorunlu alan. Diğer bilgileri daha sonra ekleyebilirsiniz.
              </p>
            </div>

            {/* ── Gösterim Tarihi (Opsiyonel) ── */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>
                Gösterim Tarihi{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>(opsiyonel)</span>
              </label>
              <input
                type="date"
                style={FORM_INPUT}
                value={form.showDate}
                onChange={(e) => setForm({ ...form, showDate: e.target.value })}
              />
            </div>

            {/* ── Salon (Opsiyonel) ── */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>
                Salon{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>(opsiyonel)</span>
              </label>
              <input
                list="session-halls"
                style={FORM_INPUT}
                value={form.hallInput}
                placeholder="Salon seç veya yeni salon adı yaz…"
                onChange={(e) => setForm({ ...form, hallInput: e.target.value })}
              />
              <datalist id="session-halls">
                {halls.map((h) => (
                  <option key={h.id} value={h.name} />
                ))}
              </datalist>
              {form.hallInput.trim() && !hallExists && (
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 11,
                    color: '#0369a1',
                    background: '#e0f2fe',
                    border: '1px solid #bae6fd',
                    borderRadius: 5,
                    padding: '5px 8px',
                  }}
                >
                  Yeni salon oluşturulacak:{' '}
                  <strong>{form.hallInput.trim()}</strong>
                </div>
              )}
            </div>

            {/* ── Gösterim Dili ── */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>
                Gösterim Dili{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>(opsiyonel)</span>
              </label>
              <select
                style={{ ...FORM_INPUT, height: 34 }}
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="">— Seçilmedi —</option>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Gösterim Formatı ── */}
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>
                Gösterim Formatı{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>(opsiyonel)</span>
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: 6,
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  background: '#f9fafb',
                }}
              >
                {FORMAT_OPTIONS.map((fmt) => (
                  <label
                    key={fmt}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={form.formats.includes(fmt)}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          formats: e.target.checked
                            ? [...prev.formats, fmt]
                            : prev.formats.filter((f) => f !== fmt),
                        }))
                      }
                    />
                    {fmt}
                  </label>
                ))}
              </div>
            </div>

            {/* ── Durum ── */}
            <div style={{ marginBottom: 20 }}>
              <label style={LABEL}>Durum</label>
              <select
                style={{ ...FORM_INPUT, height: 34 }}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MovieSessionStatus })}
              >
                <option value="SCHEDULED">Planlı</option>
                <option value="CANCELLED">İptal</option>
                <option value="ARCHIVED">Arşiv</option>
              </select>
            </div>

            {/* endAt info */}
            {movie?.durationMinutes && form.showTime && form.showDate && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '8px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#15803d',
                }}
              >
                Film süresi {movie.durationMinutes} dk →{' '}
                <strong>
                  Bitiş saati backend tarafından otomatik hesaplanır
                </strong>
              </div>
            )}

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                paddingTop: 4,
                borderTop: '1px solid #f3f4f6',
              }}
            >
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Vazgeç
              </Button>
              <Button
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  if (!accessToken) return;
                  if (!form.showTime.trim()) {
                    setFormError('Gösterim saati zorunludur.');
                    return;
                  }
                  if (!/^\d{2}:\d{2}$/.test(form.showTime)) {
                    setFormError("Gösterim saati HH:MM formatında olmalıdır (örn: 19:30).");
                    return;
                  }
                  setSaving(true);
                  setFormError(null);
                  try {
                    const payload = toPayload(form, halls);
                    if (editing) {
                      const updated = await apiMovieSessionForMovieUpdate(
                        accessToken, tenantId, mallId, movieId, editing.id, payload,
                      );
                      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      void loadRefs();
                      toast.success('Seans güncellendi');
                    } else {
                      const created = await apiMovieSessionForMovieCreate(
                        accessToken, tenantId, mallId, movieId, payload,
                      );
                      setRows((prev) => [created, ...prev]);
                      setTotal((t) => t + 1);
                      void loadRefs();
                      toast.success('Seans oluşturuldu');
                    }
                    setShowForm(false);
                  } catch (err) {
                    setFormError(err instanceof Error ? err.message : 'Kayıt hatası');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
