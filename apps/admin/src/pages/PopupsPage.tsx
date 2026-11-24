import { RichTextEditor } from '../components/RichTextEditor';
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
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ListFilterBar } from '../components/ui/ListFilterBar';
import { IconArchive, IconPencil, IconTrash } from '../components/ui/icons';
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

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tüm durumlar' },
  { value: 'DRAFT', label: 'Taslak' },
  { value: 'SCHEDULED', label: 'Zamanlanmış' },
  { value: 'PUBLISHED', label: 'Yayında' },
  { value: 'ARCHIVED', label: 'Arşiv' },
];

const STATUS_STYLE: Record<PopupStatus, { bg: string; color: string; label: string; dot: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#374151', label: 'Taslak', dot: '#9ca3af' },
  SCHEDULED: { bg: '#fef3c7', color: '#92400e', label: 'Zamanlanmış', dot: '#f59e0b' },
  PUBLISHED: { bg: '#d1fae5', color: '#065f46', label: 'Yayında', dot: '#10b981' },
  ARCHIVED: { bg: '#e5e7eb', color: '#6b7280', label: 'Arşiv', dot: '#9ca3af' },
};

function StatusBadge({ status }: { status: PopupStatus }) {
  const c = STATUS_STYLE[status];
  return (
    <span className="cms-status-badge" style={{ background: c.bg, color: c.color }}>
      <span className="cms-status-badge__dot" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

type ConfirmState =
  | { kind: 'delete'; id: string; title: string }
  | { kind: 'archive'; id: string; title: string };

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
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CmsPopup | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tenantId = mallCtx.status === 'ready' ? mallCtx.tenantId : '';
  const mallId = mallCtx.status === 'ready' ? mallCtx.mallId : '';

  const load = useCallback(async () => {
    if (!accessToken || !tenantId || !mallId) return;
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
    if (!accessToken || !tenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      const u = await apiPopupPublish(accessToken, tenantId, id);
      setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)));
      toast.success('Popup yayınlandı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayınlanamadı');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleArchive(id: string) {
    if (!accessToken || !tenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      const u = await apiPopupArchive(accessToken, tenantId, id);
      setRows((prev) => prev.map((r) => (r.id === u.id ? u : r)));
      toast.success('Popup arşivlendi');
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Arşivlenemedi');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken || !tenantId || actionBusyId) return;
    setActionBusyId(id);
    try {
      await apiPopupDelete(accessToken, tenantId, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      toast.success('Popup silindi');
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi');
    } finally {
      setActionBusyId(null);
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
        <ListFilterBar
          searchValue={filterSearch}
          onSearchChange={setFilterSearch}
          searchLabel="Popuplar içinde ara"
          statusValue={filterStatus}
          onStatusChange={(value) => setFilterStatus(value as PopupStatus | '')}
          statusOptions={STATUS_FILTER_OPTIONS}
          trailing={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Filtrele
            </Button>
          }
        />

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
                <RichTextEditor value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
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
          <div className="cms-data-table-wrap">
          <table className="cms-data-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Kanallar</th>
                <th>Durum</th>
                <th style={{ textAlign: 'right' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const busy = actionBusyId === p.id;
                return (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td style={{ color: '#6b7280', fontSize: 12 }}>{formatChannels(p.channels)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    <div className="cms-data-table__actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => { setEditing(p); setForm(toForm(p)); setShowForm(true); }}
                      >
                        <IconPencil />
                        Düzenle
                      </Button>
                      {can('popup:publish') && (p.status === 'DRAFT' || p.status === 'SCHEDULED') && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handlePublish(p.id)}>
                          Yayınla
                        </Button>
                      )}
                      {can('popup:publish') && p.status !== 'ARCHIVED' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: 'archive', id: p.id, title: p.title })}
                        >
                          <IconArchive />
                          Arşivle
                        </Button>
                      )}
                      {can('popup:delete') && (
                        <Button
                          variant="dangerSoft"
                          size="sm"
                          disabled={busy}
                          onClick={() => setConfirm({ kind: 'delete', id: p.id, title: p.title })}
                        >
                          <IconTrash />
                          Sil
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        <ConfirmDialog
          open={confirm !== null}
          title={confirm?.kind === 'delete' ? 'Popup sil' : 'Popup arşivle'}
          description={
            confirm?.kind === 'delete'
              ? `"${confirm.title}" popup kaydını silmek istediğinizden emin misiniz?`
              : `"${confirm?.title ?? ''}" popup kaydını arşivlemek istediğinizden emin misiniz?`
          }
          confirmLabel={confirm?.kind === 'delete' ? 'Sil' : 'Arşivle'}
          variant={confirm?.kind === 'delete' ? 'danger' : 'default'}
          confirming={Boolean(confirm && actionBusyId === confirm.id)}
          onCancel={() => {
            if (!actionBusyId) setConfirm(null);
          }}
          onConfirm={() => {
            if (!confirm) return;
            if (confirm.kind === 'delete') void handleDelete(confirm.id);
            else void handleArchive(confirm.id);
          }}
        />
      </div>
    </PageContainer>
  );
}
