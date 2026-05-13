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
import {
  apiCinemasList,
  apiMovieSessionCancel,
  apiMovieSessionCreate,
  apiMovieSessionDelete,
  apiMovieSessionUpdate,
  apiMovieSessionsList,
  apiMoviesList,
  type CmsCinema,
  type CmsMovie,
  type CreateMovieSessionPayload,
  type MovieSessionRow,
  type MovieSessionStatus,
} from '../lib/api';

const STATUS_STYLE: Record<MovieSessionStatus, { bg: string; color: string; label: string }> = {
  SCHEDULED: { bg: '#dbeafe', color: '#1e40af', label: 'Planlı' },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b', label: 'İptal' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv' },
};

function StatusBadge({ status }: { status: MovieSessionStatus }) {
  const c = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

type FormState = {
  cinemaId: string;
  movieId: string;
  hallName: string;
  startsAt: string;
  endsAt: string;
  language: string;
  subtitle: string;
  format: string;
  ticketUrl: string;
  status: MovieSessionStatus;
};

const EMPTY: FormState = {
  cinemaId: '',
  movieId: '',
  hallName: '',
  startsAt: '',
  endsAt: '',
  language: '',
  subtitle: '',
  format: '',
  ticketUrl: '',
  status: 'SCHEDULED',
};

function toForm(s: MovieSessionRow): FormState {
  return {
    cinemaId: s.cinemaId,
    movieId: s.movieId,
    hallName: s.hallName ?? '',
    startsAt: s.startsAt ? s.startsAt.slice(0, 16) : '',
    endsAt: s.endsAt ? s.endsAt.slice(0, 16) : '',
    language: s.language ?? '',
    subtitle: s.subtitle ?? '',
    format: s.format ?? '',
    ticketUrl: s.ticketUrl ?? '',
    status: s.status,
  };
}

function toPayload(f: FormState): CreateMovieSessionPayload {
  return {
    cinemaId: f.cinemaId,
    movieId: f.movieId,
    hallName: f.hallName || undefined,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : '',
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
    language: f.language || undefined,
    subtitle: f.subtitle || undefined,
    format: f.format || undefined,
    ticketUrl: f.ticketUrl || undefined,
    status: f.status,
  };
}

export function MovieSessionsPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const [rows, setRows] = useState<MovieSessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [cinemas, setCinemas] = useState<CmsCinema[]>([]);
  const [movies, setMovies] = useState<CmsMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<MovieSessionStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [startsFrom, setStartsFrom] = useState('');
  const [startsTo, setStartsTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MovieSessionRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = activeTenantId;
  const mallId = activeMallId ?? undefined;

  const loadRefs = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId) return;
    try {
      const [cRes, mRes] = await Promise.all([
        apiCinemasList(accessToken, tenantId, mallId, { limit: 100, status: 'ACTIVE' }),
        apiMoviesList(accessToken, tenantId, { limit: 200, status: 'ACTIVE' }),
      ]);
      setCinemas(cRes.cinemas);
      setMovies(mRes.movies);
    } catch {
      setCinemas([]);
      setMovies([]);
    }
  }, [accessToken, tenantId, mallId]);

  const load = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiMovieSessionsList(accessToken, tenantId, mallId, {
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        startsFrom: startsFrom || undefined,
        startsTo: startsTo || undefined,
        limit: 80,
      });
      setRows(data.sessions);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch, startsFrom, startsTo]);

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

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
        <PageHeader title="Film seansları" />
        <EmptyState title="Tenant seçilmedi" />
      </PageContainer>
    );
  }
  if (!mallId) {
    return (
      <PageContainer>
        <PageHeader title="Film seansları" />
        <EmptyState title="AVM seçilmedi" description="Seanslar AVM + sinema kapsamlıdır." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Film seansları"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} seans</span>}
        action={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setForm({ ...EMPTY, cinemaId: cinemas[0]?.id ?? '', movieId: movies[0]?.id ?? '' });
              setFormError(null);
              setShowForm(true);
            }}
          >
            + Yeni seans
          </Button>
        }
      />
      <div style={{ fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Ara…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MovieSessionStatus | '')}
            style={inputStyle}
          >
            <option value="">Tüm durumlar</option>
            <option value="SCHEDULED">Planlı</option>
            <option value="CANCELLED">İptal</option>
            <option value="ARCHIVED">Arşiv</option>
          </select>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Başlangıç</span>
          <input type="datetime-local" value={startsFrom} onChange={(e) => setStartsFrom(e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>—</span>
          <input type="datetime-local" value={startsTo} onChange={(e) => setStartsTo(e.target.value)} style={inputStyle} />
          <Button variant="secondary" onClick={() => void load()}>
            Filtrele
          </Button>
        </div>
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState title="Seans yok" description="Önce sinema ve film oluşturun." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 4px' }}>Başlangıç</th>
                <th style={{ padding: '8px 4px' }}>Sinema</th>
                <th style={{ padding: '8px 4px' }}>Film</th>
                <th style={{ padding: '8px 4px' }}>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                    {new Date(s.startsAt).toLocaleString('tr-TR')}
                  </td>
                  <td style={{ padding: '8px 4px' }}>{s.cinema.name}</td>
                  <td style={{ padding: '8px 4px' }}>{s.movie.title}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {s.status === 'SCHEDULED' && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          if (!accessToken) return;
                          try {
                            const u = await apiMovieSessionCancel(accessToken, tenantId, mallId, s.id);
                            setRows((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                            toast.success('İptal edildi');
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Hata');
                          }
                        }}
                      >
                        İptal
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(s);
                        setForm(toForm(s));
                        setFormError(null);
                        setShowForm(true);
                      }}
                    >
                      Düzenle
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        if (!accessToken || !window.confirm('Seans silinsin mi?')) return;
                        try {
                          await apiMovieSessionDelete(accessToken, tenantId, mallId, s.id);
                          setRows((prev) => prev.filter((x) => x.id !== s.id));
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
            <h3 style={{ margin: '0 0 16px' }}>{editing ? 'Seans düzenle' : 'Yeni seans'}</h3>
            {formError && <ErrorBanner message={formError} />}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sinema</label>
            <select
              style={{ ...inputStyle, marginBottom: 10 }}
              value={form.cinemaId}
              onChange={(e) => setForm({ ...form, cinemaId: e.target.value })}
            >
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Film</label>
            <select
              style={{ ...inputStyle, marginBottom: 10 }}
              value={form.movieId}
              onChange={(e) => setForm({ ...form, movieId: e.target.value })}
            >
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Salon</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.hallName} onChange={(e) => setForm({ ...form, hallName: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Başlangıç</label>
            <input type="datetime-local" style={{ ...inputStyle, marginBottom: 10 }} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Bitiş (opsiyonel)</label>
            <input type="datetime-local" style={{ ...inputStyle, marginBottom: 10 }} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Dil</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Altyazı</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Format</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Bilet URL</label>
            <input style={{ ...inputStyle, marginBottom: 10 }} value={form.ticketUrl} onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Durum</label>
            <select
              style={{ ...inputStyle, marginBottom: 14 }}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as MovieSessionStatus })}
            >
              <option value="SCHEDULED">Planlı</option>
              <option value="CANCELLED">İptal</option>
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
                  if (!accessToken || !form.cinemaId || !form.movieId || !form.startsAt) {
                    setFormError('Sinema, film ve başlangıç zorunludur.');
                    return;
                  }
                  setSaving(true);
                  setFormError(null);
                  try {
                    const payload = toPayload(form);
                    if (!payload.startsAt) {
                      setFormError('Başlangıç saati geçersiz.');
                      setSaving(false);
                      return;
                    }
                    if (editing) {
                      const updated = await apiMovieSessionUpdate(accessToken, tenantId, mallId, editing.id, payload);
                      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      toast.success('Güncellendi');
                    } else {
                      const created = await apiMovieSessionCreate(accessToken, tenantId, mallId, payload);
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
