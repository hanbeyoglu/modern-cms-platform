import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { ContentChannelFields } from '../components/ContentChannelFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import { validateRangeSchedule } from '../lib/publishing-workflow';
import { DEFAULT_CONTENT_CHANNELS, formatChannels } from '../lib/content-channels';
import { Button } from '../components/ui/Button';
import {
  apiPopupArchive,
  apiPopupCreate,
  apiPopupDelete,
  apiPopupPublish,
  apiPopupUpdate,
  apiPopupsList,
  type CmsPopup,
  type ContentChannel,
  type CreatePopupPayload,
  type PopupStatus,
} from '../lib/api';
import { usePermission } from '../hooks/usePermission';
import { useMallRequired } from '../hooks/useMallRequired';

const STATUS_STYLE: Record<PopupStatus, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv' },
};

function StatusBadge({ status }: { status: PopupStatus }) {
  const c = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

type FormState = {
  title: string;
  description: string;
  imageMediaId: string;
  imageMediaWidthOverride: string;
  imageMediaHeightOverride: string;
  linkUrl: string;
  buttonText: string;
  startAt: string;
  endAt: string;
  sortOrder: string;
  status: PopupStatus;
  channels: ContentChannel[];
  showOnce: boolean;
  closable: boolean;
};

const EMPTY: FormState = {
  title: '',
  description: '',
  imageMediaId: '',
  imageMediaWidthOverride: '',
  imageMediaHeightOverride: '',
  linkUrl: '',
  buttonText: '',
  startAt: '',
  endAt: '',
  sortOrder: '0',
  status: 'DRAFT',
  channels: [...DEFAULT_CONTENT_CHANNELS],
  showOnce: false,
  closable: true,
};

function toForm(p: CmsPopup): FormState {
  return {
    title: p.title,
    description: p.description ?? '',
    imageMediaId: p.imageMediaId ?? '',
    imageMediaWidthOverride: p.imageMediaWidthOverride ? String(p.imageMediaWidthOverride) : '',
    imageMediaHeightOverride: p.imageMediaHeightOverride ? String(p.imageMediaHeightOverride) : '',
    linkUrl: p.linkUrl ?? '',
    buttonText: p.buttonText ?? '',
    startAt: p.startAt ? p.startAt.slice(0, 16) : '',
    endAt: p.endAt ? p.endAt.slice(0, 16) : '',
    sortOrder: String(p.sortOrder),
    status: p.status,
    channels: p.channels?.length ? [...p.channels] : [...DEFAULT_CONTENT_CHANNELS],
    showOnce: p.showOnce,
    closable: p.closable,
  };
}

function parseOptionalDimension(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toPayload(f: FormState): CreatePopupPayload {
  return {
    title: f.title,
    description: f.description || undefined,
    imageMediaId: f.imageMediaId || undefined,
    imageMediaWidthOverride: parseOptionalDimension(f.imageMediaWidthOverride),
    imageMediaHeightOverride: parseOptionalDimension(f.imageMediaHeightOverride),
    linkUrl: f.linkUrl || undefined,
    buttonText: f.buttonText || undefined,
    startAt: f.startAt ? new Date(f.startAt).toISOString() : undefined,
    endAt: f.endAt ? new Date(f.endAt).toISOString() : undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
    channels: f.channels.length ? f.channels : undefined,
    showOnce: f.showOnce,
    closable: f.closable,
  };
}

export function PopupsPage() {
  const { accessToken } = useAuth();
  const mallCtx = useMallRequired();
  const { can } = usePermission();
  const [rows, setRows] = useState<CmsPopup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<PopupStatus | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsPopup | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (mallCtx.status === 'no-tenant') {
    return (
      <PageContainer>
        <PageHeader title="Popuplar" />
        <EmptyState title="Tenant seçilmedi" description="Üstten tenant seçin." />
      </PageContainer>
    );
  }
  if (mallCtx.status === 'loading') {
    return (
      <PageContainer>
        <PageHeader title="Popuplar" />
        <LoadingState label="AVM bilgileri yükleniyor…" />
      </PageContainer>
    );
  }
  if (mallCtx.status === 'no-malls') {
    return (
      <PageContainer>
        <PageHeader title="Popuplar" />
        <EmptyState title="AVM bulunamadı" description={mallCtx.message} />
      </PageContainer>
    );
  }
  if (mallCtx.status === 'no-selection') {
    return (
      <PageContainer>
        <PageHeader title="Popuplar" />
        <EmptyState title="AVM seçilmedi" description="Popuplar AVM kapsamlıdır; üstten bir AVM seçin." />
      </PageContainer>
    );
  }

  const { tenantId, mallId } = mallCtx;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPopupsList(accessToken, tenantId, {
        mallId,
        status: filterStatus || undefined,
        search: filterSearch || undefined,
        limit: 50,
      });
      setRows(data.popups);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Popuplar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId, filterStatus, filterSearch]);

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
  const labelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 3,
  };

  async function handleSubmit() {
    if (!accessToken || !tenantId || !mallId) return;
    const scheduleErr = validateRangeSchedule(form.status, form.startAt);
    if (scheduleErr) {
      setFormError(scheduleErr);
      return;
    }
    if (!form.title.trim()) {
      setFormError('Başlık zorunludur.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(form);
      if (editing) {
        const u = await apiPopupUpdate(accessToken, tenantId, editing.id, payload);
        setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)));
        toast.success('Popup güncellendi');
      } else {
        const c = await apiPopupCreate(accessToken, tenantId, payload, mallId);
        setRows((prev) => [c, ...prev]);
        setTotal((t) => t + 1);
        toast.success('Popup oluşturuldu');
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const u = await apiPopupPublish(accessToken, tenantId, id);
      setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)));
      toast.success('Popup yayınlandı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayınlanamadı');
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId) return;
    try {
      const u = await apiPopupArchive(accessToken, tenantId, id);
      setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)));
      toast.success('Popup arşivlendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Arşivlenemedi');
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm('Bu popup silinsin mi?')) return;
    try {
      await apiPopupDelete(accessToken, tenantId, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      toast.success('Popup silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Popuplar"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} kayıt</span>}
        action={
          can('popup:create') ? (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
                setFormError(null);
                setShowForm(true);
              }}
            >
              + Yeni Popup
            </Button>
          ) : undefined
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
            onChange={(e) => setFilterStatus(e.target.value as PopupStatus | '')}
            style={inputStyle}
          >
            <option value="">Tüm durumlar</option>
            <option value="DRAFT">Taslak</option>
            <option value="SCHEDULED">Zamanlanmış</option>
            <option value="PUBLISHED">Yayında</option>
            <option value="ARCHIVED">Arşiv</option>
          </select>
          <Button variant="secondary" onClick={() => void load()}>
            Filtrele
          </Button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {loading && <LoadingState />}

        {showForm && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 20, background: '#fafafa' }}>
            <h3 style={{ marginTop: 0 }}>{editing ? 'Popup düzenle' : 'Yeni popup'}</h3>
            {formError && <p style={{ color: '#b91c1c' }}>{formError}</p>}
            <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
              <div>
                <label style={labelStyle}>Başlık *</label>
                <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Açıklama</label>
                <textarea style={inputStyle} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <ContextualMediaPicker
                  context="POPUP_IMAGE"
                  value={form.imageMediaId}
                  mallId={mallId}
                  onChange={(id) => setForm({ ...form, imageMediaId: id })}
                  dimensionOverride={{
                    width: parseOptionalDimension(form.imageMediaWidthOverride),
                    height: parseOptionalDimension(form.imageMediaHeightOverride),
                  }}
                  onDimensionOverrideChange={(dimensions) => setForm({
                    ...form,
                    imageMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                    imageMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                  })}
                />
              </div>
              <div>
                <label style={labelStyle}>Bağlantı URL</label>
                <input style={inputStyle} value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Buton metni</label>
                <input style={inputStyle} value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
              </div>
              <ContentChannelFields
                channels={form.channels}
                onChange={(channels) => setForm({ ...form, channels })}
                labelStyle={labelStyle}
                disabled={saving}
              />
              <PublishingWorkflowFields
                mode="range"
                status={form.status}
                startAt={form.startAt}
                endAt={form.endAt}
                onStatusChange={(status) => setForm({ ...form, status })}
                onStartAtChange={(startAt) => setForm({ ...form, startAt })}
                onEndAtChange={(endAt) => setForm({ ...form, endAt })}
                labelStyle={labelStyle}
                inputStyle={inputStyle}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.showOnce} onChange={(e) => setForm({ ...form, showOnce: e.target.checked })} />
                Kullanıcıya bir kez göster
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.closable} onChange={(e) => setForm({ ...form, closable: e.target.checked })} />
                Kapatılabilir
              </label>
              <div>
                <label style={labelStyle}>Sıra</label>
                <input type="number" style={inputStyle} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>
                İptal
              </Button>
            </div>
          </div>
        )}

        {!loading && rows.length === 0 && !showForm && (
          <EmptyState title="Popup yok" description="Yeni popup ekleyerek başlayın." />
        )}

        {rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: 8 }}>Başlık</th>
                <th style={{ padding: 8 }}>Kanallar</th>
                <th style={{ padding: 8 }}>Durum</th>
                <th style={{ padding: 8 }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>{p.title}</td>
                  <td style={{ padding: 8, color: '#6b7280', fontSize: 12 }}>{formatChannels(p.channels)}</td>
                  <td style={{ padding: 8 }}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    <Button variant="ghost" onClick={() => { setEditing(p); setForm(toForm(p)); setShowForm(true); }}>
                      Düzenle
                    </Button>
                    {can('popup:publish') && p.status !== 'PUBLISHED' && (
                      <Button variant="ghost" onClick={() => void handlePublish(p.id)}>
                        Yayınla
                      </Button>
                    )}
                    {can('popup:publish') && p.status !== 'ARCHIVED' && (
                      <Button variant="ghost" onClick={() => void handleArchive(p.id)}>
                        Arşivle
                      </Button>
                    )}
                    {can('popup:delete') && (
                      <Button variant="ghost" onClick={() => void handleDelete(p.id)}>
                        Sil
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
