import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  apiAnalyticsSummary,
  apiDashboardSummary,
  apiNotificationsList,
  type CmsNotification,
  type DashboardSummary,
  type DashboardTimelineType,
} from '../lib/api';

type KpiCardProps = {
  label: string;
  value: number | null;
  accent: string;
  href: string;
  helper: string;
};

const EMPTY_SUMMARY: DashboardSummary = {
  totalStores: 0,
  activeCampaigns: 0,
  upcomingEvents: 0,
  activeSliders: 0,
  activePopups: 0,
  mediaCount: 0,
  servicesCount: 0,
  recentActivity: [],
  upcomingContent: [],
};

const TYPE_LABELS: Record<DashboardTimelineType, string> = {
  campaign: 'Kampanya',
  event: 'Etkinlik',
  slider: 'Slider',
  popup: 'Popup',
  page: 'Sayfa',
  media: 'Medya',
  service: 'Hizmet',
  store: 'Mağaza',
};

function formatNumber(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('tr-TR');
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function KpiCard({ label, value, accent, href, helper }: KpiCardProps) {
  return (
    <Link
      to={href}
      style={{
        display: 'block',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '18px 18px 16px',
        textDecoration: 'none',
        color: '#111827',
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{label}</div>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: accent, flexShrink: 0 }} />
      </div>
      <div style={{ marginTop: 12, fontSize: 30, lineHeight: 1, fontWeight: 750, letterSpacing: 0 }}>
        {formatNumber(value)}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>{helper}</div>
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h2>
        {action && (
          <Link to={action.href} style={{ color: '#2563eb', fontSize: 12, textDecoration: 'none' }}>
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const { accessToken, activeTenantId, activeMallId, user, tenants, malls } = useAuth();
  const { can } = usePermission();
  const canViewAnalytics = can('analytics:view');
  const canReadNotifications = can('notification:read');
  const activeTenant = tenants.find((t) => t.id === activeTenantId);
  const activeMall = malls.find((m) => m.id === activeMallId);
  const contextLabel = [activeTenant?.name, activeMall?.name].filter(Boolean).join(' › ');

  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [analyticsPeek, setAnalyticsPeek] = useState<{
    totalEvents: number | null;
    pageViews: number | null;
  }>({ totalEvents: null, pageViews: null });
  const [opsNotifications, setOpsNotifications] = useState<CmsNotification[]>([]);

  useEffect(() => {
    if (!accessToken || !activeTenantId) {
      setSummary(EMPTY_SUMMARY);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    void apiDashboardSummary(accessToken, activeTenantId, activeMallId ?? undefined)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSummary(EMPTY_SUMMARY);
          setSummaryError(error instanceof Error ? error.message : 'Dashboard özeti alınamadı.');
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTenantId, activeMallId]);

  useEffect(() => {
    if (!accessToken || !activeTenantId || !user || !canViewAnalytics) {
      setAnalyticsPeek({ totalEvents: null, pageViews: null });
      return;
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const dateFrom = `${from.toISOString().slice(0, 10)}T00:00:00.000Z`;
    const dateTo = `${to.toISOString().slice(0, 10)}T23:59:59.999Z`;
    let cancelled = false;
    void apiAnalyticsSummary(accessToken, activeTenantId, activeMallId ?? undefined, { dateFrom, dateTo })
      .then((result) => {
        if (!cancelled) setAnalyticsPeek({ totalEvents: result.totalEvents, pageViews: result.pageViews });
      })
      .catch(() => {
        if (!cancelled) setAnalyticsPeek({ totalEvents: null, pageViews: null });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTenantId, activeMallId, user, canViewAnalytics]);

  useEffect(() => {
    if (!accessToken || !activeTenantId || !canReadNotifications) {
      setOpsNotifications([]);
      return;
    }
    let cancelled = false;
    void apiNotificationsList(accessToken, activeTenantId, activeMallId ?? undefined, { limit: 4 })
      .then((result) => {
        if (!cancelled) setOpsNotifications(result.items);
      })
      .catch(() => {
        if (!cancelled) setOpsNotifications([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTenantId, activeMallId, canReadNotifications]);

  const kpis = useMemo(
    () => [
      {
        label: 'Aktif mağazalar',
        value: summaryLoading ? null : summary.totalStores,
        accent: '#2563eb',
        href: '/mall-stores',
        helper: activeMall ? 'Seçili lokasyonda yayında' : 'Tüm lokasyonlarda yayında',
      },
      {
        label: 'Aktif kampanyalar',
        value: summaryLoading ? null : summary.activeCampaigns,
        accent: '#be123c',
        href: '/campaigns',
        helper: 'Bugün ziyaretçiye açık',
      },
      {
        label: 'Yaklaşan etkinlikler',
        value: summaryLoading ? null : summary.upcomingEvents,
        accent: '#047857',
        href: '/events',
        helper: 'Takvimde sıradaki içerikler',
      },
      {
        label: 'Aktif sliderlar',
        value: summaryLoading ? null : summary.activeSliders,
        accent: '#7c3aed',
        href: '/sliders',
        helper: 'Ana vitrin ve yerleşimler',
      },
      {
        label: 'Aktif popuplar',
        value: summaryLoading ? null : summary.activePopups,
        accent: '#c2410c',
        href: '/popups',
        helper: 'Ziyaretçiye gösterimde',
      },
      {
        label: 'Medya varlıkları',
        value: summaryLoading ? null : summary.mediaCount,
        accent: '#0891b2',
        href: '/media',
        helper: 'Demo görsel havuzu',
      },
      {
        label: 'Lokasyon hizmetleri',
        value: summaryLoading ? null : summary.servicesCount,
        accent: '#4f46e5',
        href: '/services',
        helper: 'Danışma, vale, aile alanları',
      },
      {
        label: 'Sayfa görüntüleme',
        value: analyticsPeek.pageViews,
        accent: '#65a30d',
        href: '/analytics',
        helper: 'Son 7 gün analitik özeti',
      },
    ],
    [activeMall, analyticsPeek.pageViews, summary, summaryLoading],
  );

  const quickActions = [
    { label: 'Kampanya ekle', href: '/campaigns', allowed: can('campaign:create') },
    { label: 'Etkinlik planla', href: '/events', allowed: can('event:create') },
    { label: 'Slider düzenle', href: '/sliders', allowed: can('slider:update') },
    { label: 'Popup yayınla', href: '/popups', allowed: can('popup:create') },
    { label: 'Medya yükle', href: '/media', allowed: can('media:upload') },
    { label: 'Hizmet ekle', href: '/services', allowed: can('service:create') },
  ].filter((item) => item.allowed);

  return (
    <PageContainer>
      <PageHeader title="Gösterge Paneli" subtitle={contextLabel || 'Tenant seçin'} />

      {!activeTenantId ? (
        <div
          style={{
            padding: '32px 24px',
            border: '2px dashed #d1d5db',
            borderRadius: 8,
            textAlign: 'center',
            color: '#6b7280',
            fontSize: 14,
          }}
        >
          <p style={{ margin: 0 }}>Başlamak için yukarıdan bir tenant seçin.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {summaryError && (
            <div style={{ padding: 12, border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', background: '#fff5f5', fontSize: 13 }}>
              {summaryError}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: 14,
            }}
          >
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18 }}>
            <Panel title="Son aktiviteler" action={{ label: 'İçeriklere git', href: '/search' }}>
              {summary.recentActivity.length === 0 ? (
                <div style={{ padding: 18, color: '#9ca3af', fontSize: 13 }}>Henüz aktivite yok.</div>
              ) : (
                <div>
                  {summary.recentActivity.map((item, index) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      to={item.href}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px minmax(0, 1fr) auto',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 16px',
                        color: '#111827',
                        textDecoration: 'none',
                        borderBottom: index < summary.recentActivity.length - 1 ? '1px solid #f3f4f6' : 'none',
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: '#6b7280', fontWeight: 600 }}>{TYPE_LABELS[item.type]}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{formatDate(item.timestamp)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Yaklaşan içerikler" action={{ label: 'Takvime hazırlan', href: '/events' }}>
              {summary.upcomingContent.length === 0 ? (
                <div style={{ padding: 18, color: '#9ca3af', fontSize: 13 }}>Planlanmış içerik bulunmuyor.</div>
              ) : (
                <div>
                  {summary.upcomingContent.map((item, index) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      to={item.href}
                      style={{
                        display: 'grid',
                        gap: 5,
                        padding: '12px 16px',
                        color: '#111827',
                        textDecoration: 'none',
                        borderBottom: index < summary.upcomingContent.length - 1 ? '1px solid #f3f4f6' : 'none',
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: '#6b7280', fontWeight: 600 }}>{TYPE_LABELS[item.type]}</span>
                      <span style={{ fontWeight: 650 }}>{item.title}</span>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{formatDate(item.scheduledAt)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
            <Panel title="Hızlı işlemler">
              <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {quickActions.length === 0 ? (
                  <span style={{ color: '#9ca3af', fontSize: 13 }}>Bu kullanıcı için hızlı işlem yok.</span>
                ) : (
                  quickActions.map((action) => (
                    <Link
                      key={action.label}
                      to={action.href}
                      style={{
                        padding: '9px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 8,
                        color: '#111827',
                        textDecoration: 'none',
                        fontSize: 13,
                        fontWeight: 650,
                        background: '#f9fafb',
                      }}
                    >
                      {action.label}
                    </Link>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Operasyon özeti" action={canReadNotifications ? { label: 'Bildirimler', href: '/notifications' } : undefined}>
              <div style={{ padding: 16, display: 'grid', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#6b7280' }}>Son 7 gün olay</span>
                  <strong>{formatNumber(analyticsPeek.totalEvents)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#6b7280' }}>Okunmamış bildirim önizlemesi</span>
                  <strong>{opsNotifications.length}</strong>
                </div>
                {opsNotifications.slice(0, 2).map((notification) => (
                  <div key={notification.id} style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                    <div style={{ fontWeight: 650 }}>{notification.title}</div>
                    <div style={{ color: '#6b7280', marginTop: 3 }}>{notification.message}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
