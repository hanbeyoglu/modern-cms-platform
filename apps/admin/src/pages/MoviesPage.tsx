import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import {
  apiMovieCreate,
  apiMovieDelete,
  apiMovieUpdate,
  apiMoviesList,
  type CmsMovie,
  type CreateMoviePayload,
  type MovieStatus,
} from '../lib/api';

const STATUS_STYLE: Record<MovieStatus, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#d1fae5', color: '#065f46', label: 'Aktif' },
  PASSIVE: { bg: '#fef3c7', color: '#92400e', label: 'Pasif' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv' },
};

function StatusBadge({ status }: { status: MovieStatus }) {
  const c = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

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
  releaseDate: string;
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
  releaseDate: '',
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
    releaseDate: m.releaseDate ? m.releaseDate.slice(0, 10) : '',
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
    releaseDate: f.releaseDate ? new Date(f.releaseDate).toISOString() : undefined,
    status: f.status,
  };
}

export function MoviesPage() {
  const { accessToken, activeTenantId } = useAuth();
  const [rows, setRows] = useState<CmsMovie[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<MovieStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsMovie | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = activeTenantId;

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiMoviesList(accessToken, tenantId, {
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 80,
      });
      setRows(data.movies);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, filterStatus, filterSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
  };

  if (!tenantId) {
    return (
      <PageContainer>
        <PageHeader title="Filmler" />
        <EmptyState title="Tenant seçilmedi" description="Filmler tenant kapsamlıdır." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Filmler"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} kayıt</span>}
        action={
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
        }
      />
      <div style={{ fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Başlığa göre ara…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            style={{ ...inputStyle, width: 200 }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MovieStatus | '')}
            style={inputStyle}
          >
            <option value="">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PASSIVE">Pasif</option>
            <option value="ARCHIVED">Arşiv</option>
          </select>
          <Button variant="secondary" onClick={() => void load()}>
            Filtrele
          </Button>
        </div>
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="Film yok" description="Tenant genelinde film oluşturun; seanslarda AVM bazında kullanılır." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 4px' }}>Başlık</th>
                <th style={{ padding: '8px 4px' }}>Süre (dk)</th>
                <th style={{ padding: '8px 4px' }}>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 4px' }}>{m.title}</td>
                  <td style={{ padding: '8px 4px' }}>{m.durationMinutes ?? '—'}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <StatusBadge status={m.status} />
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(m);
                        setForm(toForm(m));
                        setFormError(null);
                        setShowForm(true);
                      }}
                    >
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        if (!accessToken || !window.confirm('Film silinsin mi?')) return;
                        try {
                          await apiMovieDelete(accessToken, tenantId, m.id);
                          setRows((prev) => prev.filter((x) => x.id !== m.id));
                          setTotal((t) => t - 1);
                          toast.success('Silindi');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Hata');
                        }
                      }}
                    >
                      Sil
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div style={{ background: '#fff', borderRadius: 8, maxWidth: 480, width: '100%', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Film düzenle' : 'Yeni film'}</h3>
            {formError && <ErrorBanner message={formError} />}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Başlık</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Slug</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Orijinal başlık</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.originalTitle} onChange={(e) => setForm({ ...form, originalTitle: e.target.value })} />
            <div style={{ marginBottom: 10 }}>
              <ContextualMediaPicker
                context="MOVIE_POSTER"
                value={form.posterMediaId}
                onChange={(id) => setForm({ ...form, posterMediaId: id })}
              />
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Özet</label>
            <textarea style={{ ...inputStyle, minHeight: 50, marginBottom: 10 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Süre (dk)</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Tür</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Yaş sınırı / not</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Fragman URL</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.trailerUrl} onChange={(e) => setForm({ ...form, trailerUrl: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Vizyon (YYYY-MM-DD)</label>
            <input type="date" style={{ ...inputStyle, marginBottom: 10 }} value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Durum</label>
            <select
              style={{ ...inputStyle, marginBottom: 14 }}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as MovieStatus })}
            >
              <option value="ACTIVE">Aktif</option>
              <option value="PASSIVE">Pasif</option>
              <option value="ARCHIVED">Arşiv</option>
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
                  setSaving(true);
                  setFormError(null);
                  try {
                    const payload = toPayload(form);
                    if (editing) {
                      const updated = await apiMovieUpdate(accessToken, tenantId, editing.id, payload);
                      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      toast.success('Güncellendi');
                    } else {
                      const created = await apiMovieCreate(accessToken, tenantId, payload);
                      setRows((prev) => [created, ...prev]);
                      setTotal((t) => t + 1);
                      toast.success('Oluşturuldu');
                    }
                    setShowForm(false);
                  } catch (err) {
                    setFormError(err instanceof Error ? err.message : 'Kayıt hatası');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
