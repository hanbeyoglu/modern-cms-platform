import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import {
  apiNotificationsList,
  apiNotificationsMarkAllRead,
  apiNotificationDelete,
  apiNotificationMarkRead,
  notificationEntityHref,
  type CmsNotification,
  type NotificationSeverity,
  type NotificationType,
} from '../lib/api';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  INFO: 'Bilgi',
  SUCCESS: 'Başarı',
  WARNING: 'Uyarı',
  ERROR: 'Hata',
};

const TYPE_LABEL: Record<NotificationType, string> = {
  SYSTEM: 'Sistem',
  CONTENT: 'İçerik',
  SCHEDULING: 'Zamanlama',
  ANALYTICS: 'Analitik',
  SECURITY: 'Güvenlik',
};

export function NotificationsPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const mallId = activeMallId ?? undefined;

  const [filterUnread, setFilterUnread] = useState<'all' | 'unread' | 'read'>('all');
  const [severity, setSeverity] = useState<NotificationSeverity | ''>('');
  const [type, setType] = useState<NotificationType | ''>('');
  const [items, setItems] = useState<CmsNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    try {
      const unreadParam =
        filterUnread === 'unread' ? true : filterUnread === 'read' ? false : undefined;
      const res = await apiNotificationsList(accessToken, activeTenantId, mallId, {
        unread: unreadParam,
        severity: severity || undefined,
        type: type || undefined,
        limit: 50,
        skip: 0,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Liste alınamadı');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, mallId, filterUnread, severity, type]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    if (!accessToken || !activeTenantId) return;
    try {
      await apiNotificationMarkRead(accessToken, activeTenantId, mallId, id);
      toast.success('Okundu işaretlendi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  }

  async function markAll() {
    if (!accessToken || !activeTenantId) return;
    try {
      await apiNotificationsMarkAllRead(accessToken, activeTenantId, mallId);
      toast.success('Tümü okundu');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  }

  async function remove(id: string) {
    if (!accessToken || !activeTenantId) return;
    try {
      await apiNotificationDelete(accessToken, activeTenantId, mallId, id);
      toast.success('Silindi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  }

  if (!can('notification:read')) {
    return (
      <PageContainer>
        <PageHeader title="Bildirimler" subtitle="Bu sayfayı görüntüleme yetkiniz yok." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Bildirimler"
        subtitle="Operasyonel ve sistem bildirimleri. E-posta veya anlık bildirim gönderilmez."
      />

      {!activeTenantId ? (
        <p style={{ color: '#6b7280' }}>Önce bir tenant seçin.</p>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'flex-end',
              marginBottom: 20,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              Durum
              <select
                value={filterUnread}
                onChange={(e) => setFilterUnread(e.target.value as 'all' | 'unread' | 'read')}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', minWidth: 140 }}
              >
                <option value="all">Tümü</option>
                <option value="unread">Okunmamış</option>
                <option value="read">Okunmuş</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              Önem
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as NotificationSeverity | '')}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', minWidth: 140 }}
              >
                <option value="">Tümü</option>
                {(Object.keys(SEVERITY_LABEL) as NotificationSeverity[]).map((k) => (
                  <option key={k} value={k}>
                    {SEVERITY_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              Tür
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NotificationType | '')}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #e5e7eb', minWidth: 140 }}
              >
                <option value="">Tümü</option>
                {(Object.keys(TYPE_LABEL) as NotificationType[]).map((k) => (
                  <option key={k} value={k}>
                    {TYPE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Yenile
            </Button>
            {can('notification:update') ? (
              <Button type="button" onClick={() => void markAll()}>
                Tümünü okundu işaretle
              </Button>
            ) : null}
          </div>

          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Toplam {total} kayıt {loading ? '(yükleniyor…)' : ''}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {items.length === 0 && !loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Kayıt yok</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>Başlık</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>Tür</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>Önem</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>Tarih</th>
                    <th style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((n) => {
                    const href = notificationEntityHref(n.entityType, n.entityId);
                    const unread = !n.readAt;
                    return (
                      <tr key={n.id} style={{ background: unread ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600 }}>{n.title}</div>
                          <div style={{ color: '#6b7280', marginTop: 4, maxWidth: 480 }}>{n.message}</div>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                          {TYPE_LABEL[n.type]}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                          {SEVERITY_LABEL[n.severity]}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                          {formatTime(n.createdAt)}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                            {href ? (
                              <Link to={href} style={{ color: '#2563eb', fontSize: 12 }}>
                                Kayda git
                              </Link>
                            ) : null}
                            {unread && can('notification:update') ? (
                              <button
                                type="button"
                                onClick={() => void markRead(n.id)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: '#2563eb',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  padding: 0,
                                }}
                              >
                                Okundu
                              </button>
                            ) : null}
                            {can('notification:delete') ? (
                              <button
                                type="button"
                                onClick={() => void remove(n.id)}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: '#b91c1c',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  padding: 0,
                                }}
                              >
                                Sil
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
