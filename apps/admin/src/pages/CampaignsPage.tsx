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
  apiCampaignArchive,
  apiCampaignCreate,
  apiCampaignDelete,
  apiCampaignPublish,
  apiCampaignUpdate,
  apiCampaignsList,
  apiMediaList,
  apiMallStoresList,
} from '../lib/api';
import type { CmsCampaign, ContentStatus, CreateCampaignPayload, MallStore, MediaAsset } from '../lib/api';

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

function storeRowLabel(store: CmsCampaign['store']): string {
  if (!store) return '—';
  const base = store.globalStore.name;
  return store.localName ? `${base} — ${store.localName}` : base;
}

type FormState = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverMediaId: string;
  startAt: string;
  endAt: string;
  terms: string;
  couponCode: string;
  buttonText: string;
  linkUrl: string;
  storeId: string;
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
  terms: '',
  couponCode: '',
  buttonText: '',
  linkUrl: '',
  storeId: '',
  sortOrder: '0',
  status: 'DRAFT',
  dynamicJson: '',
};

function cToForm(c: CmsCampaign): FormState {
  return {
    title: c.title,
    slug: c.slug,
    shortDescription: c.shortDescription ?? '',
    description: c.description ?? '',
    coverMediaId: c.coverMediaId ?? '',
    startAt: c.startAt ? c.startAt.slice(0, 16) : '',
    endAt: c.endAt ? c.endAt.slice(0, 16) : '',
    terms: c.terms ?? '',
    couponCode: c.couponCode ?? '',
    buttonText: c.buttonText ?? '',
    linkUrl: c.linkUrl ?? '',
    storeId: c.storeId ?? '',
    sortOrder: String(c.sortOrder),
    status: c.status,
    dynamicJson: c.dynamicFieldsJson ? JSON.stringify(c.dynamicFieldsJson, null, 2) : '',
  };
}

function formToPayload(f: FormState): CreateCampaignPayload {
  return {
    title: f.title,
    slug: f.slug.trim() || undefined,
    shortDescription: f.shortDescription || undefined,
    description: f.description || undefined,
    coverMediaId: f.coverMediaId || undefined,
    startAt: f.startAt ? new Date(f.startAt).toISOString() : undefined,
    endAt: f.endAt ? new Date(f.endAt).toISOString() : undefined,
    terms: f.terms || undefined,
    couponCode: f.couponCode || undefined,
    buttonText: f.buttonText || undefined,
    linkUrl: f.linkUrl || undefined,
    storeId: f.storeId || undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
  };
}

export function CampaignsPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const [items, setItems] = useState<CmsCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ContentStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mallStores, setMallStores] = useState<MallStore[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsCampaign | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = activeTenantId;
  const mallId = activeMallId ?? undefined;

  const loadCampaigns = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCampaignsList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setItems(data.campaigns);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kampanyalar yüklenemedi');
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

  const loadStores = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId) {
      setMallStores([]);
      return;
    }
    try {
      const data = await apiMallStoresList(accessToken, tenantId, mallId, { limit: 200 });
      setMallStores(data.items);
    } catch {
      setMallStores([]);
    }
  }, [accessToken, tenantId, mallId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: CmsCampaign) {
    setEditing(c);
    setForm(cToForm(c));
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
      const payload: CreateCampaignPayload = { ...formToPayload(form), dynamicFieldsJson };
      if (editing) {
        const updated = await apiCampaignUpdate(accessToken, tenantId, editing.id, payload, mallId);
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        toast.success('Kampanya güncellendi');
      } else {
        const created = await apiCampaignCreate(accessToken, tenantId, payload, mallId);
        setItems((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        toast.success('Kampanya oluşturuldu');
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
    if (!window.confirm('Bu kampanyayı silmek istediğinizden emin misiniz?')) return;
    try {
      await apiCampaignDelete(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
      toast.success('Kampanya silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  async function handlePublish(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiCampaignPublish(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Kampanya yayınlandı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayınlanamadı');
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const updated = await apiCampaignArchive(accessToken, tenantId, id, mallId);
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('Kampanya arşivlendi');
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
        <PageHeader title="Kampanyalar" />
        <EmptyState title="Tenant seçilmedi" description="Kampanyalar için üstten bir tenant seçin." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Kampanyalar"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} kampanya</span>}
        action={<Button variant="primary" onClick={openCreate}>+ Yeni Kampanya</Button>}
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
        <button type="button" onClick={() => void loadCampaigns()} style={inputStyle}>
          Filtrele
        </button>
      </div>

      {!mallId && (
        <p style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
          Mağaza seçimi için üstten bir AVM (mall) seçin; kampanya oluştururken <code>storeId</code> bu listeyle eşlenir.
        </p>
      )}

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
          <h3 style={{ marginTop: 0 }}>{editing ? 'Kampanyayı düzenle' : 'Yeni kampanya'}</h3>
          {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <div>
              <label style={labelStyle}>Başlık *</label>
              <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Slug</label>
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
            <div>
              <label style={labelStyle}>AVM mağazası</label>
              <select
                style={inputStyle}
                value={form.storeId}
                onChange={(e) => setForm({ ...form, storeId: e.target.value })}
                disabled={!mallId}
              >
                <option value="">—</option>
                {mallStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.globalStore.name}
                    {s.localName ? ` — ${s.localName}` : ''}
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
              <label style={labelStyle}>Şartlar</label>
              <textarea style={{ ...inputStyle, minHeight: 64 }} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Kupon kodu</label>
              <input style={inputStyle} value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value })} />
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
              entityType="CAMPAIGN"
              entityId={editing.id}
              fields={['title', 'shortDescription', 'description', 'terms', 'buttonText']}
              title="Çeviriler"
            />
          )}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: 8 }}>Başlık</th>
            <th style={{ padding: 8 }}>Mağaza</th>
            <th style={{ padding: 8 }}>Durum</th>
            <th style={{ padding: 8 }}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 8 }}>
                <strong>{c.title}</strong>
                <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.slug}</div>
              </td>
              <td style={{ padding: 8, color: '#6b7280' }}>
                {storeRowLabel(c.store)}
              </td>
              <td style={{ padding: 8 }}>
                <StatusBadge status={c.status} />
              </td>
              <td style={{ padding: 8 }}>
                <button type="button" onClick={() => openEdit(c)} style={{ marginRight: 6 }}>
                  Düzenle
                </button>
                {c.status !== 'PUBLISHED' && (
                  <button type="button" onClick={() => void handlePublish(c.id)} style={{ marginRight: 6 }}>
                    Yayınla
                  </button>
                )}
                {c.status !== 'ARCHIVED' && (
                  <button type="button" onClick={() => void handleArchive(c.id)} style={{ marginRight: 6 }}>
                    Arşiv
                  </button>
                )}
                <button type="button" onClick={() => void handleDelete(c.id)}>
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
