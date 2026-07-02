import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import { ContentSlugFields } from '../components/ContentSlugFields';
import {
  apiMovieCategoriesList,
  apiMovieCreate,
  apiMovieDelete,
  apiMovieUpdate,
  apiMoviesList,
  tmdbPosterUrl,
  type CmsMovie,
  type CreateMoviePayload,
  type MovieCategory,
  type MovieStatus,
} from '../lib/api';
import { apiMovieResyncFromProvider } from '../lib/api/movie-providers';

// ─── Form State ───────────────────────────────────────────────────────────────

type FormState = {
  title: string;
  slug: string;
  originalTitle: string;
  posterMediaId: string;
  description: string;
  durationMinutes: string;
  genre: string;
  rating: string;
  trailerUrl: string;
  ticketUrl: string;
  releaseDate: string;
  publishStartAt: string;
  publishEndAt: string;
  sortOrder: string;
  categoryIds: string[];
  status: MovieStatus;
};

const EMPTY: FormState = {
  title: '',
  slug: '',
  originalTitle: '',
  posterMediaId: '',
  description: '',
  durationMinutes: '',
  genre: '',
  rating: '',
  trailerUrl: '',
  ticketUrl: '',
  releaseDate: '',
  publishStartAt: '',
  publishEndAt: '',
  sortOrder: '0',
  categoryIds: [],
  status: 'ACTIVE',
};

function toForm(m: CmsMovie): FormState {
  return {
    title: m.title,
    slug: m.slug,
    originalTitle: m.originalTitle ?? '',
    posterMediaId: m.posterMediaId ?? '',
    description: m.description ?? '',
    durationMinutes: m.durationMinutes != null ? String(m.durationMinutes) : '',
    genre: m.genre ?? '',
    rating: m.rating ?? '',
    trailerUrl: m.trailerUrl ?? '',
    ticketUrl: m.ticketUrl ?? '',
    releaseDate: m.releaseDate ? m.releaseDate.slice(0, 10) : '',
    publishStartAt: m.publishStartAt ? m.publishStartAt.slice(0, 10) : '',
    publishEndAt: m.publishEndAt ? m.publishEndAt.slice(0, 10) : '',
    sortOrder: String(m.sortOrder ?? 0),
    categoryIds: m.categories.map((c) => c.categoryId),
    status: m.status,
  };
}

function toPayload(f: FormState): CreateMoviePayload {
  return {
    title: f.title,
    slug: f.slug.trim() || undefined,
    originalTitle: f.originalTitle || undefined,
    posterMediaId: f.posterMediaId || undefined,
    description: f.description || undefined,
    durationMinutes: f.durationMinutes.trim() ? parseInt(f.durationMinutes, 10) : undefined,
    genre: f.genre || undefined,
    rating: f.rating || undefined,
    trailerUrl: f.trailerUrl || undefined,
    ticketUrl: f.ticketUrl || undefined,
    releaseDate: f.releaseDate ? new Date(f.releaseDate).toISOString() : undefined,
    publishStartAt: f.publishStartAt ? new Date(f.publishStartAt).toISOString() : null,
    publishEndAt: f.publishEndAt ? new Date(f.publishEndAt).toISOString() : null,
    sortOrder: f.sortOrder.trim() ? parseInt(f.sortOrder, 10) : 0,
    categoryIds: f.categoryIds,
    status: f.status,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(value?: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value?: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function moviePosterPreview(movie: CmsMovie): string | null {
  if (movie.posterMediaId && movie.posterMedia?.publicUrl) return movie.posterMedia.publicUrl;
  return tmdbPosterUrl(movie.posterPath);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPencil() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconFilm() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 2v6h-6" />
      <path d="M3 22v-6h6" />
      <path d="M3.5 9a9 9 0 0 1 14.83-3.36M20.5 15a9 9 0 0 1-14.83 3.36" />
    </svg>
  );
}

function IconDots() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconFilmLarge() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#d1d5db"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ w, h, radius = 4 }: { w: number | string; h: number; radius?: number }) {
  return (
    <div
      className="movie-skeleton"
      style={{ width: w, height: h, borderRadius: radius, flexShrink: 0 }}
    />
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
          <td style={{ padding: '14px 12px' }}>
            <div
              className="movie-skeleton"
              style={{ width: 56, height: 84, borderRadius: 6 }}
            />
          </td>
          <td style={{ padding: '14px 12px' }}>
            <SkeletonBlock w={180} h={15} />
            <div style={{ marginTop: 7 }}>
              <SkeletonBlock w={120} h={12} />
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
              <SkeletonBlock w={44} h={18} radius={3} />
            </div>
          </td>
          <td style={{ padding: '14px 12px' }}>
            <SkeletonBlock w={90} h={12} />
            <div style={{ marginTop: 6 }}>
              <SkeletonBlock w={110} h={12} />
            </div>
          </td>
          <td style={{ padding: '14px 12px' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <SkeletonBlock w={56} h={22} radius={10} />
              <SkeletonBlock w={56} h={22} radius={10} />
            </div>
          </td>
          <td style={{ padding: '14px 12px' }}>
            <SkeletonBlock w={80} h={12} />
            <div style={{ marginTop: 6 }}>
              <SkeletonBlock w={64} h={12} />
            </div>
          </td>
          <td style={{ padding: '14px 12px' }}>
            <SkeletonBlock w={54} h={22} radius={10} />
          </td>
          <td style={{ padding: '14px 12px' }}>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <SkeletonBlock w={30} h={30} radius={6} />
              <SkeletonBlock w={30} h={30} radius={6} />
              <SkeletonBlock w={30} h={30} radius={6} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MovieStatus, { bg: string; color: string; label: string; dot: string }> = {
  ACTIVE: { bg: '#d1fae5', color: '#065f46', label: 'Aktif', dot: '#10b981' },
  PASSIVE: { bg: '#fef3c7', color: '#92400e', label: 'Pasif', dot: '#f59e0b' },
  ARCHIVED: { bg: '#f3f4f6', color: '#6b7280', label: 'Arşiv', dot: '#9ca3af' },
};

function StatusBadge({ status }: { status: MovieStatus }) {
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
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Icon Button ──────────────────────────────────────────────────────────────

interface IconBtnProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  spinning?: boolean;
  children: React.ReactNode;
}

function IconBtn({ label, onClick, disabled, danger, spinning, children }: IconBtnProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="movie-icon-btn"
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
        animation: spinning ? 'spin 1s linear infinite' : 'none',
      }}
    >
      {children}
    </button>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 16px',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        minWidth: 90,
        gap: 2,
      }}
    >
      <span style={{ fontSize: 20, fontWeight: 700, color: color ?? '#111827', lineHeight: 1.2 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ─── Input style ──────────────────────────────────────────────────────────────

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
  appearance: 'auto',
};

const FORM_INPUT: CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const LABEL: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 };

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MoviesPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const navigate = useNavigate();

  const tenantId = activeTenantId;
  const mallId = activeMallId ?? undefined;

  // List state
  const [rows, setRows] = useState<CmsMovie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, passive: 0, archived: 0 });

  // Filters (API-level)
  const [filterStatus, setFilterStatus] = useState<MovieStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSortBy, setFilterSortBy] = useState<'sortOrder' | 'title' | 'releaseDate' | 'createdAt'>('sortOrder');

  // Filters (client-side)
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterProvider, setFilterProvider] = useState<'TMDB' | 'MANUAL' | ''>('');

  // Categories list
  const [categories, setCategories] = useState<MovieCategory[]>([]);

  // Form / edit modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsMovie | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // Per-row state
  const [rowResyncingId, setRowResyncingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiMoviesList(accessToken, tenantId, {
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        sortBy: filterSortBy,
        mallId,
        limit: 80,
      });
      setRows(data.movies);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch, filterSortBy]);

  const loadStats = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    try {
      const [all, active, passive, archived] = await Promise.all([
        apiMoviesList(accessToken, tenantId, { limit: 1 }),
        apiMoviesList(accessToken, tenantId, { status: 'ACTIVE', limit: 1 }),
        apiMoviesList(accessToken, tenantId, { status: 'PASSIVE', limit: 1 }),
        apiMoviesList(accessToken, tenantId, { status: 'ARCHIVED', limit: 1 }),
      ]);
      setStats({
        total: all.total,
        active: active.total,
        passive: passive.total,
        archived: archived.total,
      });
    } catch {
      // stats non-critical
    }
  }, [accessToken, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!accessToken || !tenantId) return;
    void apiMovieCategoriesList(accessToken, tenantId)
      .then(setCategories)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : 'Kategoriler yüklenemedi'),
      );
  }, [accessToken, tenantId]);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-menu-anchor]')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  // Close menu on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Computed ────────────────────────────────────────────────────────────────

  const filteredRows = rows.filter((m) => {
    if (filterProvider && m.provider !== filterProvider) return false;
    if (filterCategoryId && !m.categories.some((c) => c.categoryId === filterCategoryId))
      return false;
    return true;
  });

  const tmdbCount = rows.filter((m) => m.provider === 'TMDB').length;
  const manualCount = rows.filter((m) => m.provider === 'MANUAL').length;

  const hasFilters = !!(filterStatus || filterSearch || filterCategoryId || filterProvider);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openEdit = (movie: CmsMovie) => {
    setEditing(movie);
    setForm(toForm(movie));
    setFormError(null);
    setShowForm(true);
  };

  const clearFilters = () => {
    setFilterSearch('');
    setFilterStatus('');
    setFilterCategoryId('');
    setFilterProvider('');
    setFilterSortBy('sortOrder');
  };

  const editingTmdbPosterUrl =
    editing && !form.posterMediaId ? tmdbPosterUrl(editing.posterPath) : null;

  // ── No tenant ───────────────────────────────────────────────────────────────

  if (!tenantId) {
    return (
      <PageContainer>
        <EmptyState title="Tenant seçilmedi" description="Filmler tenant kapsamlıdır." />
      </PageContainer>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      {/* Injected styles */}
      <style>{`
        @keyframes skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .movie-skeleton {
          background: #e5e7eb;
          animation: skeleton-pulse 1.6s ease-in-out infinite;
        }
        .movie-icon-btn:hover:not(:disabled) {
          background: #f3f4f6 !important;
          color: #374151 !important;
          border-color: #e5e7eb !important;
        }
        .movie-row:hover { background: #f8fafc; }
        .movie-row:hover .movie-poster-img { transform: scale(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .movie-filter-input:focus { outline: none; border-color: #2563eb !important; box-shadow: 0 0 0 2px rgba(37,99,235,0.12); }
        .movie-title-btn:hover { color: #1d4ed8 !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Filmler</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#9ca3af' }}>
            Tenant genelinde film yönetimi · Seanslar AVM bazında kullanılır
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
          + Yeni Film
        </Button>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <StatCard label="Toplam Film" value={stats.total} />
        <StatCard label="Aktif" value={stats.active} color="#065f46" />
        <StatCard label="Pasif" value={stats.passive} color="#92400e" />
        <StatCard label="Arşiv" value={stats.archived} color="#6b7280" />
        {tmdbCount > 0 && (
          <StatCard label="TMDB" value={tmdbCount} color="#1d4ed8" />
        )}
        {manualCount > 0 && (
          <StatCard label="Manuel" value={manualCount} />
        )}
      </div>

      {/* ── Filter toolbar ─────────────────────────────────────────────────── */}
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
        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              position: 'absolute',
              left: 9,
              color: '#9ca3af',
              display: 'flex',
              pointerEvents: 'none',
            }}
          >
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="Film adı ara…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            className="movie-filter-input"
            style={{
              height: 34,
              paddingLeft: 30,
              paddingRight: 10,
              fontSize: 13,
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              width: 200,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as MovieStatus | '')}
          className="movie-filter-input"
          style={SELECT_STYLE}
        >
          <option value="">Tüm Durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>

        {/* Category */}
        {categories.length > 0 && (
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="movie-filter-input"
            style={SELECT_STYLE}
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        )}

        {/* Provider */}
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value as 'TMDB' | 'MANUAL' | '')}
          className="movie-filter-input"
          style={SELECT_STYLE}
        >
          <option value="">Tüm Kaynaklar</option>
          <option value="TMDB">TMDB</option>
          <option value="MANUAL">Manuel</option>
        </select>

        {/* Sort */}
        <select
          value={filterSortBy}
          onChange={(e) =>
            setFilterSortBy(e.target.value as 'sortOrder' | 'title' | 'releaseDate' | 'createdAt')
          }
          className="movie-filter-input"
          style={SELECT_STYLE}
        >
          <option value="sortOrder">Sıra ile</option>
          <option value="title">Ada Göre</option>
          <option value="releaseDate">Vizyon Tarihine Göre</option>
          <option value="createdAt">Oluşturma Tarihine Göre</option>
        </select>

        {/* Apply / Clear */}
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Uygula
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            × Temizle
          </Button>
        )}

        {/* Result count */}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
          {filteredRows.length !== total
            ? `${filteredRows.length} / ${total} film`
            : `${total} film`}
        </span>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && <ErrorBanner message={error} />}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
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
            <tr
              style={{
                background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                textAlign: 'left',
              }}
            >
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', width: 80 }}>
                Poster
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Film
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', width: 160 }}>
                Yayın
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', width: 200 }}>
                Kategoriler
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', width: 170 }}>
                Seans
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', width: 90 }}>
                Durum
              </th>
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', width: 120, textAlign: 'right' }}>
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '60px 24px',
                      gap: 12,
                    }}
                  >
                    <IconFilmLarge />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: 15 }}>
                        {hasFilters ? 'Filtre sonucu bulunamadı' : 'Henüz film eklenmedi'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
                        {hasFilters
                          ? 'Farklı filtreler deneyin veya aramayı temizleyin.'
                          : 'Tenant genelinde film oluşturun; seanslarda AVM bazında kullanılır.'}
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
                        + Yeni Film Oluştur
                      </Button>
                    )}
                    {hasFilters && (
                      <Button variant="secondary" onClick={clearFilters}>
                        Filtreleri Temizle
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((m) => (
                <MovieRow
                  key={m.id}
                  movie={m}
                  rowResyncingId={rowResyncingId}
                  openMenuId={openMenuId}
                  onEdit={openEdit}
                  onSessions={() => navigate(`/movies/${m.id}/sessions`)}
                  onResync={async () => {
                    if (!accessToken) return;
                    setRowResyncingId(m.id);
                    try {
                      const updated = await apiMovieResyncFromProvider(accessToken, tenantId, m.id);
                      setRows((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
                      toast.success('TMDB\'den güncellendi');
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Güncelleme hatası');
                    } finally {
                      setRowResyncingId(null);
                    }
                  }}
                  onDelete={async () => {
                    if (!accessToken || !window.confirm('Bu film silinsin mi?')) return;
                    try {
                      await apiMovieDelete(accessToken, tenantId, m.id);
                      setRows((prev) => prev.filter((x) => x.id !== m.id));
                      setTotal((t) => t - 1);
                      void loadStats();
                      toast.success('Film silindi');
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Silme hatası');
                    }
                  }}
                  onMenuToggle={(id) => setOpenMenuId((prev) => (prev === id ? null : id))}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit / Create Modal ────────────────────────────────────────────── */}
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
              maxWidth: 640,
              width: '100%',
              padding: '24px 24px 20px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                {editing ? `Film Düzenle` : 'Yeni Film'}
              </h3>
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

            <label style={LABEL}>Başlık *</label>
            <input
              style={{ ...FORM_INPUT, marginBottom: 12 }}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Film başlığı"
            />

            <ContentSlugFields
              title={form.title}
              slug={form.slug}
              useCustomSlug={false}
              persistedSlug={editing?.slug}
              disabled
              labelStyle={LABEL}
              inputStyle={FORM_INPUT}
              onUseCustomSlugChange={() => undefined}
              onSlugChange={() => undefined}
            />

            <label style={{ ...LABEL, marginTop: 12 }}>Orijinal Başlık</label>
            <input
              style={{ ...FORM_INPUT, marginBottom: 12 }}
              value={form.originalTitle}
              onChange={(e) => setForm({ ...form, originalTitle: e.target.value })}
              placeholder="Orijinal dildeki başlık"
            />

            <div style={{ marginBottom: 12 }}>
              <ContextualMediaPicker
                context="MOVIE_POSTER"
                value={form.posterMediaId}
                onChange={(id) => setForm({ ...form, posterMediaId: id })}
                fallbackPreview={
                  editing && editingTmdbPosterUrl
                    ? { imageUrl: editingTmdbPosterUrl, alt: editing.title, title: editing.title, badge: 'TMDB' }
                    : undefined
                }
              />
            </div>

            <label style={LABEL}>Özet</label>
            <textarea
              style={{ ...FORM_INPUT, minHeight: 60, marginBottom: 12 }}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Film hakkında kısa açıklama"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={LABEL}>Süre (dk)</label>
                <input
                  style={FORM_INPUT}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  placeholder="120"
                />
              </div>
              <div>
                <label style={LABEL}>Yaş Sınırı / Not</label>
                <input
                  style={FORM_INPUT}
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  placeholder="7+, 13+, Genel…"
                />
              </div>
            </div>

            <label style={LABEL}>Eski Tür Alanı</label>
            <input
              style={{ ...FORM_INPUT, marginBottom: 12 }}
              value={form.genre}
              onChange={(e) => setForm({ ...form, genre: e.target.value })}
            />

            <fieldset
              style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', margin: '0 0 12px' }}
            >
              <legend style={{ ...LABEL, padding: '0 4px', margin: 0 }}>Kategoriler</legend>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 8,
                  maxHeight: 160,
                  overflowY: 'auto',
                }}
              >
                {categories.map((category) => (
                  <label
                    key={category.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(category.id)}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          categoryIds: e.target.checked
                            ? [...prev.categoryIds, category.id]
                            : prev.categoryIds.filter((id) => id !== category.id),
                        }))
                      }
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <label style={LABEL}>Fragman URL</label>
              {form.trailerUrl.trim() && (
                <Button
                  variant="secondary"
                  onClick={() => window.open(form.trailerUrl.trim(), '_blank', 'noopener,noreferrer')}
                >
                  Fragmanı Aç
                </Button>
              )}
            </div>
            <input
              type="url"
              style={{ ...FORM_INPUT, marginBottom: 12 }}
              value={form.trailerUrl}
              onChange={(e) => setForm({ ...form, trailerUrl: e.target.value })}
              placeholder="https://youtube.com/…"
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <label style={LABEL}>Bilet Linki</label>
              {form.ticketUrl.trim() && (
                <Button
                  variant="secondary"
                  onClick={() => window.open(form.ticketUrl.trim(), '_blank', 'noopener,noreferrer')}
                >
                  Bilet Linkini Aç
                </Button>
              )}
            </div>
            <input
              type="url"
              style={{ ...FORM_INPUT, marginBottom: 12 }}
              value={form.ticketUrl}
              onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })}
              placeholder="https://..."
            />

            <label style={LABEL}>Vizyon Tarihi</label>
            <input
              type="date"
              style={{ ...FORM_INPUT, marginBottom: 12 }}
              value={form.releaseDate}
              onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={LABEL}>Yayın Başlangıcı</label>
                <input
                  type="date"
                  style={FORM_INPUT}
                  value={form.publishStartAt}
                  onChange={(e) => setForm({ ...form, publishStartAt: e.target.value })}
                />
              </div>
              <div>
                <label style={LABEL}>Yayın Bitişi</label>
                <input
                  type="date"
                  style={FORM_INPUT}
                  value={form.publishEndAt}
                  onChange={(e) => setForm({ ...form, publishEndAt: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={LABEL}>Sıra</label>
                <input
                  type="number"
                  min={0}
                  style={FORM_INPUT}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
              <div>
                <label style={LABEL}>Durum</label>
                <select
                  style={{ ...FORM_INPUT, height: 31 }}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as MovieStatus })}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="PASSIVE">Pasif</option>
                  <option value="ARCHIVED">Arşiv</option>
                </select>
              </div>
            </div>

            {editing?.tmdbId && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '10px 14px',
                  background: '#eff6ff',
                  borderRadius: 8,
                  border: '1px solid #bfdbfe',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    TMDB
                  </span>
                  <span style={{ color: '#374151' }}>#{editing.tmdbId}</span>
                  {editing.tmdbVoteAverage != null && (
                    <span style={{ color: '#6b7280' }}>⭐ {editing.tmdbVoteAverage.toFixed(1)}</span>
                  )}
                  {editing.notCurrentlyAvailable && (
                    <span style={{ color: '#b45309', fontWeight: 600 }}>Şu an mevcut değil</span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={resyncing}
                  onClick={async () => {
                    if (!accessToken || !editing) return;
                    setResyncing(true);
                    try {
                      await apiMovieResyncFromProvider(accessToken, tenantId, editing.id);
                      const refreshed = await apiMoviesList(accessToken, tenantId, {
                        search: editing.title,
                        limit: 5,
                      });
                      const updated = refreshed.movies.find((x) => x.id === editing.id);
                      if (updated) {
                        setEditing(updated);
                        setForm(toForm(updated));
                        setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      }
                      toast.success("TMDB'den güncellendi");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Güncelleme hatası');
                    } finally {
                      setResyncing(false);
                    }
                  }}
                >
                  {resyncing ? 'Güncelleniyor…' : "TMDB'den Güncelle"}
                </Button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Vazgeç
              </Button>
              <Button
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  if (!accessToken || !form.title.trim()) {
                    setFormError('Başlık zorunludur.');
                    return;
                  }
                  if (
                    form.publishStartAt &&
                    form.publishEndAt &&
                    form.publishEndAt < form.publishStartAt
                  ) {
                    setFormError('Yayın bitişi yayın başlangıcından küçük olamaz.');
                    return;
                  }
                  setSaving(true);
                  setFormError(null);
                  try {
                    const payload = toPayload(form);
                    if (editing) {
                      const updated = await apiMovieUpdate(accessToken, tenantId, editing.id, payload);
                      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      toast.success('Film güncellendi');
                    } else {
                      const created = await apiMovieCreate(accessToken, tenantId, payload);
                      setRows((prev) => [created, ...prev]);
                      setTotal((t) => t + 1);
                      void loadStats();
                      toast.success('Film oluşturuldu');
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

// ─── Movie Row ────────────────────────────────────────────────────────────────

interface MovieRowProps {
  movie: CmsMovie;
  rowResyncingId: string | null;
  openMenuId: string | null;
  onEdit: (m: CmsMovie) => void;
  onSessions: () => void;
  onResync: () => Promise<void>;
  onDelete: () => Promise<void>;
  onMenuToggle: (id: string) => void;
}

function MovieRow({
  movie: m,
  rowResyncingId,
  openMenuId,
  onEdit,
  onSessions,
  onResync,
  onDelete,
  onMenuToggle,
}: MovieRowProps) {
  const poster = moviePosterPreview(m);
  const isMenuOpen = openMenuId === m.id;
  const isResyncing = rowResyncingId === m.id;

  const hasPublishInfo = m.publishStartAt || m.publishEndAt || m.releaseDate;
  const categoryBadges = m.categories.slice(0, 3);
  const extraCategories = m.categories.length - categoryBadges.length;

  const session = m.sessionSummary;
  const hasSession = session !== undefined;

  return (
    <tr className="movie-row" style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s' }}>
      {/* ── Poster ── */}
      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
        <div
          style={{
            width: 56,
            height: 84,
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#f3f4f6',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {poster ? (
            <img
              src={poster}
              alt={m.title}
              className="movie-poster-img"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'block',
              }}
            />
          ) : (
            <span style={{ color: '#d1d5db', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}>
              POSTER<br />YOK
            </span>
          )}
        </div>
      </td>

      {/* ── Film bilgisi ── */}
      <td style={{ padding: '12px 12px', verticalAlign: 'middle', minWidth: 200 }}>
        <button
          type="button"
          className="movie-title-btn"
          onClick={() => onEdit(m)}
          style={{
            border: 0,
            background: 'transparent',
            padding: 0,
            color: '#111827',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            textAlign: 'left',
            lineHeight: 1.3,
            transition: 'color 0.15s',
          }}
        >
          {m.title}
        </button>
        {m.originalTitle && (
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>{m.originalTitle}</div>
        )}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          {m.provider === 'TMDB' && (
            <span
              style={{
                background: '#2563eb',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 5px',
                borderRadius: 3,
                letterSpacing: '0.03em',
              }}
            >
              TMDB
            </span>
          )}
          {m.tmdbVoteAverage != null && (
            <span style={{ fontSize: 11, color: '#6b7280' }}>⭐ {m.tmdbVoteAverage.toFixed(1)}</span>
          )}
          {m.durationMinutes != null && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.durationMinutes} dk</span>
          )}
        </div>
      </td>

      {/* ── Yayın ── */}
      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
        {hasPublishInfo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {m.releaseDate && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Vizyon
                </span>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  {formatDate(m.releaseDate)}
                </span>
              </div>
            )}
            {(m.publishStartAt || m.publishEndAt) && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Yayın
                </span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {formatDate(m.publishStartAt) || '…'}
                  {m.publishEndAt && ` → ${formatDate(m.publishEndAt)}`}
                </span>
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>
        )}
      </td>

      {/* ── Kategoriler ── */}
      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
        {m.categories.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 190 }}>
            {categoryBadges.map((c) => (
              <span
                key={c.categoryId}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 10,
                  background: '#f3f4f6',
                  color: '#374151',
                  whiteSpace: 'nowrap',
                  border: '1px solid #e5e7eb',
                }}
              >
                {c.category.name}
              </span>
            ))}
            {extraCategories > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 10,
                  background: '#eff6ff',
                  color: '#2563eb',
                  whiteSpace: 'nowrap',
                  border: '1px solid #bfdbfe',
                }}
              >
                +{extraCategories}
              </span>
            )}
          </div>
        ) : m.genre ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '3px 8px',
              borderRadius: 10,
              background: '#f3f4f6',
              color: '#6b7280',
              border: '1px solid #e5e7eb',
            }}
          >
            {m.genre}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>
        )}
      </td>

      {/* ── Seans ── */}
      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
        {!hasSession ? (
          <span style={{ fontSize: 12, color: '#d1d5db' }}>AVM seçilmedi</span>
        ) : session.sessionCount === 0 ? (
          <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
            Henüz seans oluşturulmadı
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 48 }}>Toplam</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  background: '#f3f4f6',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {session.sessionCount}
              </span>
            </div>
            {session.todaySessionStartAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 48 }}>Bugün</span>
                <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>
                  {formatTime(session.todaySessionStartAt)}
                </span>
              </div>
            )}
            {session.nextSessionStartAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 48 }}>Sonraki</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {formatTime(session.nextSessionStartAt)}
                </span>
              </div>
            )}
          </div>
        )}
      </td>

      {/* ── Durum ── */}
      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
        <StatusBadge status={m.status} />
      </td>

      {/* ── İşlemler ── */}
      <td style={{ padding: '12px 12px', verticalAlign: 'middle' }}>
        <div
          style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}
        >
          <IconBtn label="Düzenle" onClick={() => onEdit(m)}>
            <IconPencil />
          </IconBtn>

          <IconBtn label="Seanslar" onClick={onSessions}>
            <IconFilm />
          </IconBtn>

          {m.tmdbId && (
            <IconBtn
              label="TMDB'den Güncelle"
              onClick={() => void onResync()}
              disabled={isResyncing}
              spinning={isResyncing}
            >
              <IconRefresh />
            </IconBtn>
          )}

          {/* Overflow menu */}
          <div style={{ position: 'relative' }} data-menu-anchor>
            <IconBtn
              label="Daha Fazla"
              onClick={() => onMenuToggle(m.id)}
            >
              <IconDots />
            </IconBtn>

            {isMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 34,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 20,
                  minWidth: 140,
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onMenuToggle(m.id);
                    void onDelete();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '9px 14px',
                    fontSize: 13,
                    color: '#dc2626',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <IconTrash />
                  Sil
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
