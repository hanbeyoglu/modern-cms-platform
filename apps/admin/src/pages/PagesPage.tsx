import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import {
  apiPagesList,
  apiPageCreate,
  apiPageDelete,
  apiPagePublish,
  apiPageArchive,
  type CmsPage,
  type PageStatus,
  type PageType,
  type CreatePagePayload,
} from '../lib/api/pages';

const STATUS_LABELS: Record<PageStatus, string> = {
  DRAFT: 'Taslak',
  SCHEDULED: 'Zamanlanmış',
  PUBLISHED: 'Yayında',
  ARCHIVED: 'Arşiv',
};

const STATUS_COLORS: Record<PageStatus, string> = {
  DRAFT: '#6b7280',
  SCHEDULED: '#d97706',
  PUBLISHED: '#16a34a',
  ARCHIVED: '#9ca3af',
};

const TYPE_LABELS: Record<PageType, string> = {
  STANDARD: 'Standart',
  LANDING: 'Açılış',
  LEGAL: 'Hukuki',
  CONTACT: 'İletişim',
  CUSTOM: 'Özel',
};

type FormState = {
  title: string;
  slug: string;
  type: PageType;
  status: PageStatus;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  type: 'STANDARD',
  status: 'DRAFT',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
};

export function PagesPage() {
  const { token, tenantId, mallId } = useAuth();
  const navigate = useNavigate();

  const [pages, setPages] = useState<CmsPage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<PageStatus | ''>('');
  const [filterType, setFilterType] = useState<PageType | ''>('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    if (!token || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiPagesList(token, tenantId, {
        mallId: mallId ?? undefined,
        status: filterStatus || undefined,
        type: filterType || undefined,
        search: search || undefined,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });
      setPages(res.pages);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, tenantId, mallId, filterStatus, filterType, search]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  async function handleCreate() {
    if (!token || !tenantId) return;
    if (!formState.title.trim()) {
      toast.error('Başlık zorunludur');
      return;
    }
    setSaving(true);
    try {
      const payload: CreatePagePayload = {
        title: formState.title,
        slug: formState.slug || undefined,
        type: formState.type,
        status: formState.status,
        seoTitle: formState.seoTitle || undefined,
        seoDescription: formState.seoDescription || undefined,
        seoKeywords: formState.seoKeywords || undefined,
      };
      const created = await apiPageCreate(token, tenantId, payload, mallId ?? undefined);
      toast.success('Sayfa oluşturuldu');
      setShowForm(false);
      setFormState(EMPTY_FORM);
      navigate(`/pages/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || !tenantId) return;
    try {
      await apiPageDelete(token, tenantId, id, mallId ?? undefined);
      toast.success('Sayfa silindi');
      setDeleteConfirmId(null);
      void loadPages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  }

  async function handlePublish(id: string) {
    if (!token || !tenantId) return;
    try {
      await apiPagePublish(token, tenantId, id, mallId ?? undefined);
      toast.success('Sayfa yayınlandı');
      void loadPages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlanamadı');
    }
  }

  async function handleArchive(id: string) {
    if (!token || !tenantId) return;
    try {
      await apiPageArchive(token, tenantId, id, mallId ?? undefined);
      toast.success('Sayfa arşivlendi');
      void loadPages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Arşivlenemedi');
    }
  }

  const field = (key: keyof FormState) => ({
    value: formState[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setFormState((s) => ({ ...s, [key]: e.target.value })),
  });

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Sayfalar</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            {total} sayfa
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormState(EMPTY_FORM); }}
          style={btnStyle('#2563eb')}
        >
          + Yeni Sayfa
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Başlık veya slug ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle({ width: 200 })}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as PageStatus | '')} style={inputStyle()}>
          <option value="">Tüm Durumlar</option>
          {(Object.keys(STATUS_LABELS) as PageStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as PageType | '')} style={inputStyle()}>
          <option value="">Tüm Tipler</option>
          {(Object.keys(TYPE_LABELS) as PageType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={cardStyle({ marginBottom: 20 })}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Yeni Sayfa</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Başlık *</label>
              <input {...field('title')} style={inputStyle({ width: '100%' })} placeholder="Hakkımızda" />
            </div>
            <div>
              <label style={labelStyle}>Slug (boş bırakırsanız otomatik)</label>
              <input {...field('slug')} style={inputStyle({ width: '100%' })} placeholder="hakkimizda" />
            </div>
            <div>
              <label style={labelStyle}>Tip</label>
              <select {...field('type')} style={inputStyle({ width: '100%' })}>
                {(Object.keys(TYPE_LABELS) as PageType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Durum</label>
              <select {...field('status')} style={inputStyle({ width: '100%' })}>
                {(Object.keys(STATUS_LABELS) as PageStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>SEO Başlığı</label>
              <input {...field('seoTitle')} style={inputStyle({ width: '100%' })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>SEO Açıklaması</label>
              <input {...field('seoDescription')} style={inputStyle({ width: '100%' })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>SEO Anahtar Kelimeler</label>
              <input {...field('seoKeywords')} style={inputStyle({ width: '100%' })} placeholder="kelime1, kelime2" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={handleCreate} disabled={saving} style={btnStyle('#16a34a')}>
              {saving ? 'Kaydediliyor…' : 'Oluştur'}
            </button>
            <button onClick={() => setShowForm(false)} style={btnStyle('#6b7280')}>
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', color: '#b91c1c', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13, padding: 20 }}>Yükleniyor…</div>
      ) : pages.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 13, padding: 20, textAlign: 'center' }}>
          Sayfa bulunamadı.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={thStyle}>Başlık</th>
              <th style={thStyle}>Slug</th>
              <th style={thStyle}>Tip</th>
              <th style={thStyle}>Durum</th>
              <th style={thStyle}>Blok</th>
              <th style={thStyle}>Tarih</th>
              <th style={thStyle}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <button
                    onClick={() => navigate(`/pages/${p.id}`)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 600, padding: 0, fontSize: 13 }}
                  >
                    {p.title}
                  </button>
                </td>
                <td style={{ ...tdStyle, color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>{p.slug}</td>
                <td style={tdStyle}>
                  <span style={badgeStyle('#e5e7eb', '#374151')}>{TYPE_LABELS[p.type]}</span>
                </td>
                <td style={tdStyle}>
                  <span style={badgeStyle(STATUS_COLORS[p.status] + '22', STATUS_COLORS[p.status])}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td style={tdStyle}>{p.blocks.length}</td>
                <td style={{ ...tdStyle, color: '#6b7280' }}>{new Date(p.createdAt).toLocaleDateString('tr-TR')}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => navigate(`/pages/${p.id}`)} style={smallBtn('#2563eb')}>Düzenle</button>
                    {p.status !== 'PUBLISHED' && p.status !== 'ARCHIVED' && (
                      <button onClick={() => handlePublish(p.id)} style={smallBtn('#16a34a')}>Yayınla</button>
                    )}
                    {p.status !== 'ARCHIVED' && (
                      <button onClick={() => handleArchive(p.id)} style={smallBtn('#6b7280')}>Arşivle</button>
                    )}
                    {deleteConfirmId === p.id ? (
                      <>
                        <button onClick={() => handleDelete(p.id)} style={smallBtn('#dc2626')}>Evet, Sil</button>
                        <button onClick={() => setDeleteConfirmId(null)} style={smallBtn('#6b7280')}>İptal</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(p.id)} style={smallBtn('#dc2626')}>Sil</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  };
}

function smallBtn(color: string): React.CSSProperties {
  return {
    background: 'none',
    border: `1px solid ${color}`,
    borderRadius: 4,
    color,
    padding: '3px 8px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  };
}

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    ...extra,
  };
}

function cardStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 20,
    background: '#fafafa',
    ...extra,
  };
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
};

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg,
    color,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
  };
}
