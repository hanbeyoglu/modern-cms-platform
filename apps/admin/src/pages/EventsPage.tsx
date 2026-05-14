import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { TranslationPanel } from '../components/TranslationPanel';
import { Button } from '../components/ui/Button';
import {
  apiEventArchive,
  apiEventCreate,
  apiEventDelete,
  apiEventPublish,
  apiEventUpdate,
  apiEventsList,
  apiMediaList,
  type CmsEvent,
  type ContentStatus,
  type CreateEventPayload,
  type MediaAsset,
} from '../lib/api';

const STATUS_STYLE: Record<ContentStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv' },
};

function StatusBadge({ status }: { status: ContentStatus }) {
  const c = STATUS_STYLE[status];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 4,
        background: c.bg,
        color: c.color,
      }}
    >
      {c.label}
    </span>
  );
}

type FormState = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverMediaId: string;
  startAt: string;
  endAt: string;
  location: string;
  category: string;
  buttonText: string;
  linkUrl: string;
  sortOrder: string;
  status: ContentStatus;
  dynamicJson: string;
};

const EMPTY: FormState = {
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  coverMediaId: '',
  startAt: '',
  endAt: '',
  location: '',
  category: '',
  buttonText: '',
  linkUrl: '',
  sortOrder: '0',
  status: 'DRAFT',
  dynamicJson: '',
};

function evToForm(e: CmsEvent): FormState {
  return {
    title: e.title,
    slug: e.slug,
    shortDescription: e.shortDescription ?? '',
    description: e.description ?? '',
    coverMediaId: e.coverMediaId ?? '',
    startAt: e.startAt ? e.startAt.slice(0, 16) : '',
    endAt: e.endAt ? e.endAt.slice(0, 16) : '',
    location: e.location ?? '',
    category: e.category ?? '',
    buttonText: e.buttonText ?? '',
    linkUrl: e.linkUrl ?? '',
    sortOrder: String(e.sortOrder),
    status: e.status,
    dynamicJson: e.dynamicFieldsJson ? JSON.stringify(e.dynamicFieldsJson, null, 2) : '',
  };
}

function formToPayload(f: FormState): CreateEventPayload {
  return {
    title: f.title,
    slug: f.slug.trim() || undefined,
    shortDescription: f.shortDescription || undefined,
    description: f.description || undefined,
    coverMediaId: f.coverMediaId || undefined,
    startAt: f.startAt ? new Date(f.startAt).toISOString() : undefined,
    endAt: f.endAt ? new Date(f.endAt).toISOString() : undefined,
    location: f.location || undefined,
    category: f.category || undefined,
    buttonText: f.buttonText || undefined,
    linkUrl: f.linkUrl || undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
  };
}

export function EventsPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const [events, setEvents] = useState<CmsEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsEvent | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = activeTenantId;
  const mallId = activeMallId ?? undefined;

  const loadEvents = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiEventsList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Etkinlikler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch]);

  const loadMedia = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    try {
      const data = await apiMediaList(accessToken, tenantId, { limit: 200 });
      setMediaAssets(data.assets);
    } catch {
      setMediaAssets([]);
    }
  }, [accessToken, tenantId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(e: CmsEvent) {
    setEditing(e);
    setForm(evToForm(e));
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSubmit() {
    if (!accessToken || !tenantId || !form.title.trim()) {
      setFormError('Başlık zorunludur.');
      return;
    }
    let dynamicFieldsJson: Record<string, unknown> | undefined;
    const raw = form.dynamicJson.trim();
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setFormError('Dinamik alanlar geçerli bir JSON nesnesi olmalıdır.');
          return;
        }
        dynamicFieldsJson = parsed as Record<string, unknown>;
      } catch {
        setFormError('Dinamik alanlar geçerli JSON değil.');
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: CreateEventPayload = { ...formToPayload(form), dynamicFieldsJson };
      if (editing) {
        const updated = await apiEventUpdate(accessToken, tenantId, editing.id, payload, mallId);
        setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        toast.success('Etkinlik güncellendi');
      } else {
        const created = await apiEventCreate(accessToken, tenantId, payload, mallId);
        setEvents((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        toast.success('Etkinlik oluşturuldu');
      }
      cancelForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm('Bu etkinliği silmek istediğinizden emin misiniz?')) return;
    try {
      await apiEventDelete(accessToken, tenantId, id, mallId);
      setEvents((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      toast.success('Etkinlik silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  async function handlePublish(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiEventPublish(accessToken, tenantId, id, mallId);
      setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Etkinlik yayınlandı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayınlanamadı');
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiEventArchive(accessToken, tenantId, id, mallId);
      setEvents((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Etkinlik arşivlendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Arşivlenemedi');
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
  };
  const labelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 3,
  };

  if (!tenantId) {
    return (
      <PageContainer>
        <PageHeader title="Etkinlikler" />
        <EmptyState title="Tenant seçilmedi" description="Etkinlikler için üstten bir tenant seçin." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Etkinlikler"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} etkinlik</span>}
        action={<Button variant="primary" onClick={openCreate}>+ Yeni Etkinlik</Button>}
      />
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Başlığa göre ara…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          style={{ ...inputStyle, width: 200 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ContentStatus | '')}
          style={inputStyle}
        >
          <option value="">Tüm durumlar</option>
          <option value="DRAFT">Taslak</option>
          <option value="SCHEDULED">Zamanlanmış</option>
          <option value="PUBLISHED">Yayında</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>
        <button type="button" onClick={() => void loadEvents()} style={inputStyle}>
          Filtrele
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading && <LoadingState />}

      {showForm && (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
            background: '#fafafa',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{editing ? 'Etkinliği düzenle' : 'Yeni etkinlik'}</h3>
          {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <div>
              <label style={labelStyle}>Başlık *</label>
              <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Slug (boşsa başlıktan üretilir)</label>
              <input style={inputStyle} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Kapak medya</label>
              <select
                style={inputStyle}
                value={form.coverMediaId}
                onChange={(e) => setForm({ ...form, coverMediaId: e.target.value })}
              >
                <option value="">—</option>
                {mediaAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.originalName}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Başlangıç</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Bitiş</label>
                <input
                  type="datetime-local"
                  style={inputStyle}
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Konum</label>
              <input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Kategori</label>
              <input style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Kısa açıklama</label>
              <input
                style={inputStyle}
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Açıklama</label>
              <textarea
                style={{ ...inputStyle, minHeight: 72 }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Buton metni</label>
              <input style={inputStyle} value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Link URL</label>
              <input style={inputStyle} value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Sıra</label>
              <input style={inputStyle} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Durum</label>
              <select
                style={inputStyle}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ContentStatus })}
              >
                <option value="DRAFT">Taslak</option>
                <option value="SCHEDULED">Zamanlanmış</option>
                <option value="PUBLISHED">Yayında</option>
                <option value="ARCHIVED">Arşiv</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>dynamicFieldsJson</label>
              <textarea
                style={{ ...inputStyle, minHeight: 100, fontFamily: 'monospace' }}
                value={form.dynamicJson}
                onChange={(e) => setForm({ ...form, dynamicJson: e.target.value })}
                placeholder='{"sponsor":"..."}'
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button type="button" disabled={saving} onClick={() => void handleSubmit()} style={{ padding: '6px 14px' }}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" onClick={cancelForm}>
              İptal
            </button>
          </div>
          {editing && (
            <TranslationPanel
              entityType="EVENT"
              entityId={editing.id}
              fields={['title', 'shortDescription', 'description', 'buttonText']}
              title="Çeviriler"
            />
          )}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: 8 }}>Başlık</th>
            <th style={{ padding: 8 }}>Durum</th>
            <th style={{ padding: 8 }}>Tarih</th>
            <th style={{ padding: 8 }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 8 }}>
                <strong>{e.title}</strong>
                <div style={{ color: '#9ca3af', fontSize: 11 }}>{e.slug}</div>
              </td>
              <td style={{ padding: 8 }}>
                <StatusBadge status={e.status} />
                {e.status === 'SCHEDULED' && e.startAt && (
                  <div style={{ fontSize: 10, color: '#92400e', marginTop: 4 }}>
                    Yayın: {new Date(e.startAt).toLocaleString('tr-TR')}
                  </div>
                )}
              </td>
              <td style={{ padding: 8, color: '#6b7280' }}>
                {e.startAt ? e.startAt.slice(0, 10) : '—'} → {e.endAt ? e.endAt.slice(0, 10) : '—'}
              </td>
              <td style={{ padding: 8 }}>
                <button type="button" onClick={() => openEdit(e)} style={{ marginRight: 6 }}>
                  Düzenle
                </button>
                {e.status !== 'PUBLISHED' && (
                  <button type="button" onClick={() => void handlePublish(e.id)} style={{ marginRight: 6 }}>
                    Yayınla
                  </button>
                )}
                {e.status !== 'ARCHIVED' && (
                  <button type="button" onClick={() => void handleArchive(e.id)} style={{ marginRight: 6 }}>
                    Arşiv
                  </button>
                )}
                <button type="button" onClick={() => void handleDelete(e.id)}>
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </PageContainer>
  );
}
