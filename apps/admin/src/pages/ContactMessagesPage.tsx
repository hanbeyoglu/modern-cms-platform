import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import {
  contactMessageDetail,
  contactMessagesList,
  contactMessageStatus,
  notifyContactMessageChange,
  type ContactEmailNotificationStatus,
  type ContactList,
  type ContactMessage,
  type ContactStatus,
} from '../lib/api/contact-messages';

const labels: Record<ContactStatus, string> = { NEW: 'Yeni', READ: 'Okundu', ARCHIVED: 'Arşiv' };
const emailLabels: Record<ContactEmailNotificationStatus, string> = {
  PENDING: 'Bekliyor',
  SENT: 'Gönderildi',
  FAILED: 'Başarısız',
  SKIPPED: 'Atlandı',
};
const date = (value: string) => new Date(value).toLocaleString('tr-TR');
const cell = { padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' as const };
const inputStyle = {
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
};
export function ContactMessagesPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const [result, setResult] = useState<ContactList | null>(null);
  const [detail, setDetail] = useState<ContactMessage | null>(null);
  const [filters, setFilters] = useState<{
    page: number;
    search: string;
    status: ContactStatus | '';
    from: string;
    to: string;
  }>({ page: 1, search: '', status: '', from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const context = `${activeTenantId}:${activeMallId}`;
  const currentContext = useRef(context);
  currentContext.current = context;
  const load = useCallback(async () => {
    const seq = ++sequence.current;
    if (!accessToken || !activeTenantId || !activeMallId) {
      setResult(null);
      return;
    }
    const capturedContext = `${activeTenantId}:${activeMallId}`;
    setLoading(true);
    setError(null);
    try {
      const data = await contactMessagesList(accessToken, activeTenantId, activeMallId, {
        ...filters,
        status: filters.status || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      if (sequence.current === seq && currentContext.current === capturedContext) setResult(data);
    } catch {
      if (sequence.current === seq && currentContext.current === capturedContext) {
        setResult(null);
        setError('Mesajlar alınamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      if (sequence.current === seq) setLoading(false);
    }
  }, [accessToken, activeTenantId, activeMallId, filters]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    setDetail(null);
    setResult(null);
    setError(null);
    setFilters((f) => ({ ...f, page: 1 }));
  }, [context]);
  async function open(id: string) {
    if (!accessToken || !activeTenantId || !activeMallId || busy) return;
    const capturedContext = context;
    setBusy(true);
    setDetail(null);
    try {
      const item = await contactMessageDetail(accessToken, activeTenantId, activeMallId, id);
      if (currentContext.current === capturedContext) {
        setDetail(item);
        notifyContactMessageChange();
        void load();
      }
    } catch {
      if (currentContext.current === capturedContext) toast.error('Mesaj açılamadı.');
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(status: ContactStatus) {
    if (!accessToken || !activeTenantId || !activeMallId || !detail || busy) return;
    const capturedContext = context;
    setBusy(true);
    try {
      const item = await contactMessageStatus(
        accessToken,
        activeTenantId,
        activeMallId,
        detail.id,
        status,
      );
      if (currentContext.current === capturedContext) {
        setDetail(item);
        toast.success('Mesaj durumu güncellendi.');
        notifyContactMessageChange();
        void load();
      }
    } catch {
      if (currentContext.current === capturedContext)
        toast.error('İşlem tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }
  if (!activeTenantId || !activeMallId)
    return (
      <PageContainer>
        <EmptyState
          title="Tenant ve AVM seçin"
          description="İletişim mesajları seçili AVM kapsamında gösterilir."
        />
      </PageContainer>
    );
  return (
    <PageContainer>
      <PageHeader title="İletişim Mesajları" subtitle="Web sitesinden gelen ziyaretçi mesajları" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <input
          style={inputStyle}
          aria-label="Mesajlarda ara"
          placeholder="Ad, e-posta, konu veya mesajda ara"
          value={filters.search}
          maxLength={200}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
        />
        <select
          style={inputStyle}
          aria-label="Mesaj durumu"
          value={filters.status}
          onChange={(e) =>
            setFilters({ ...filters, status: e.target.value as ContactStatus | '', page: 1 })
          }
        >
          <option value="">Tüm durumlar</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <label>
          Başlangıç{' '}
          <input
            style={inputStyle}
            aria-label="Başlangıç tarihi"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value, page: 1 })}
          />
        </label>
        <label>
          Bitiş{' '}
          <input
            style={inputStyle}
            aria-label="Bitiş tarihi"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value, page: 1 })}
          />
        </label>
        <Button variant="secondary" disabled={loading} onClick={() => void load()}>
          Yenile
        </Button>
      </div>
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <p role="status">Mesajlar yükleniyor…</p>
      ) : result?.items.length === 0 ? (
        <EmptyState
          title="Mesaj bulunamadı"
          description="Bu filtrelerle eşleşen iletişim mesajı yok."
        />
      ) : (
        result && (
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Gönderen', 'E-posta', 'Konu', 'Durum', 'Gönderim tarihi', 'İşlem'].map(
                    (title) => (
                      <th key={title} style={cell}>
                        {title}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      fontWeight: item.status === 'NEW' ? 600 : 400,
                      background: item.status === 'NEW' ? '#eff6ff' : '#fff',
                    }}
                  >
                    <td style={cell}>{item.name}</td>
                    <td style={cell}>{item.email}</td>
                    <td style={cell}>{item.subject || '—'}</td>
                    <td style={cell}>{labels[item.status]}</td>
                    <td style={cell}>{date(item.createdAt)}</td>
                    <td style={cell}>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void open(item.id)}
                      >
                        Görüntüle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {result && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
          <Button
            variant="secondary"
            disabled={loading || filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            Önceki
          </Button>
          <span>
            {result.pagination.total} mesaj · Sayfa {filters.page} /{' '}
            {Math.max(1, result.pagination.totalPages)}
          </span>
          <Button
            variant="secondary"
            disabled={loading || filters.page >= result.pagination.totalPages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            Sonraki
          </Button>
        </div>
      )}
      {detail && (
        <section
          aria-label="Mesaj detayı"
          style={{
            marginTop: 24,
            background: '#fff',
            padding: 20,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2>{detail.subject || 'İletişim mesajı'}</h2>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              Kapat
            </Button>
          </div>
          <p>
            <strong>{detail.name}</strong> · {detail.email}
            {detail.phone ? ` · ${detail.phone}` : ''}
          </p>
          <p>
            {date(detail.createdAt)} · {labels[detail.status]}
          </p>
          <p style={{ color: '#374151', fontSize: 13 }}>
            E-posta bildirimi: {emailLabels[detail.emailNotificationStatus]}
            {detail.emailNotificationSentAt
              ? ` · ${date(detail.emailNotificationSentAt)}`
              : detail.emailNotificationStatus === 'PENDING'
                ? ' · henüz gönderilmedi'
                : ''}
          </p>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail.message}</p>
          <p style={{ color: '#6b7280', fontSize: 12 }}>
            KVKK onayı: {detail.kvkkConsent ? 'Verildi' : 'Yok'} · {date(detail.kvkkConsentAt)}
          </p>
          {can('contact-message:update') && (
            <div style={{ display: 'flex', gap: 8 }}>
              {detail.status !== 'ARCHIVED' && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void changeStatus(detail.status === 'NEW' ? 'READ' : 'NEW')}
                >
                  {detail.status === 'NEW' ? 'Okundu işaretle' : 'Okunmadı işaretle'}
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void changeStatus(
                    detail.status === 'ARCHIVED' ? (detail.readAt ? 'READ' : 'NEW') : 'ARCHIVED',
                  )
                }
              >
                {detail.status === 'ARCHIVED' ? 'Arşivden çıkar' : 'Arşivle'}
              </Button>
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}
