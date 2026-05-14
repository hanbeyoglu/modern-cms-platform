import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { usePermission } from '../../hooks/usePermission';
import {
  apiNotificationsList,
  apiNotificationsMarkAllRead,
  apiNotificationsUnreadCount,
  apiNotificationMarkRead,
  notificationEntityHref,
  type CmsNotification,
} from '../../lib/api';

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function NotificationBell() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<CmsNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const allowed = can('notification:read');
  const mallId = activeMallId ?? undefined;

  const refreshCount = useCallback(async () => {
    if (!accessToken || !activeTenantId || !allowed) return;
    try {
      const { count: c } = await apiNotificationsUnreadCount(accessToken, activeTenantId, mallId);
      setCount(c);
    } catch {
      /* sessiz */
    }
  }, [accessToken, activeTenantId, mallId, allowed]);

  const loadLatest = useCallback(async () => {
    if (!accessToken || !activeTenantId || !allowed) return;
    setLoading(true);
    try {
      const res = await apiNotificationsList(accessToken, activeTenantId, mallId, { limit: 8 });
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bildirimler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, mallId, allowed]);

  useEffect(() => {
    void refreshCount();
    const t = setInterval(() => void refreshCount(), 60000);
    return () => clearInterval(t);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    void loadLatest();
  }, [open, loadLatest]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!allowed || !activeTenantId) {
    return null;
  }

  async function onMarkRead(id: string) {
    if (!accessToken || !activeTenantId) return;
    try {
      await apiNotificationMarkRead(accessToken, activeTenantId, mallId, id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      void refreshCount();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  }

  async function onMarkAll() {
    if (!accessToken || !activeTenantId || !can('notification:update')) return;
    try {
      await apiNotificationsMarkAllRead(accessToken, activeTenantId, mallId);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setCount(0);
      toast.success('Tümü okundu olarak işaretlendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Bildirimler"
        style={{
          position: 'relative',
          border: '1px solid #e5e7eb',
          background: '#fff',
          borderRadius: 8,
          width: 40,
          height: 36,
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        🔔
        {count > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: 9,
              background: '#dc2626',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 44,
            width: 360,
            maxHeight: 420,
            overflow: 'auto',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Bildirimler</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {can('notification:update') && count > 0 ? (
                <button
                  type="button"
                  onClick={() => void onMarkAll()}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#2563eb',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Tümünü okundu işaretle
                </button>
              ) : null}
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                style={{ fontSize: 12, color: '#6b7280' }}
              >
                Tümü
              </Link>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Yükleniyor…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Bildirim yok
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((n) => {
                const href = notificationEntityHref(n.entityType, n.entityId);
                const unread = !n.readAt;
                return (
                  <li
                    key={n.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      padding: '10px 14px',
                      background: unread ? '#f9fafb' : '#fff',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.35 }}>
                      {n.message}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatTime(n.createdAt)}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {href ? (
                          <Link
                            to={href}
                            onClick={() => setOpen(false)}
                            style={{ fontSize: 12, color: '#2563eb' }}
                          >
                            İlgili kayıt
                          </Link>
                        ) : null}
                        {unread && can('notification:update') ? (
                          <button
                            type="button"
                            onClick={() => void onMarkRead(n.id)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#2563eb',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Okundu
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
