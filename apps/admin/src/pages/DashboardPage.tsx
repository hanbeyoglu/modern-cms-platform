import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { useCapability } from '../hooks/useCapability';
import { PageContainer } from '../components/layout/PageContainer';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { apiDashboardSummary, type DashboardTimelineType } from '../lib/api';
import { apiCampaignsList } from '../lib/api/campaigns';
import { apiEventsList } from '../lib/api/events';
import { contactMessagesCount } from '../lib/api/contact-messages';
import { useScopedLoad, type LoadState } from '../lib/scoped-load';

const ENDING_SOON_DAYS = 7;

const TYPE_LABELS: Record<DashboardTimelineType, string> = {
  campaign: 'Kampanya',
  event: 'Etkinlik',
  slider: 'Slayt',
  popup: 'Açılır pencere',
  page: 'Sayfa',
  media: 'Medya',
  service: 'Hizmet',
  store: 'Mağaza',
};

/** Which permission + capability a timeline item type needs to be shown. */
const TYPE_ACCESS: Record<DashboardTimelineType, { permission: string; capability: string }> = {
  campaign: { permission: 'campaign:read', capability: 'campaigns' },
  event: { permission: 'event:read', capability: 'events' },
  slider: { permission: 'slider:read', capability: 'sliders' },
  popup: { permission: 'popup:read', capability: 'popups' },
  page: { permission: 'page:read', capability: 'pages' },
  media: { permission: 'media:read', capability: 'media' },
  service: { permission: 'service:read', capability: 'location_services' },
  store: { permission: 'mall-store:read', capability: 'stores' },
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak',
  SCHEDULED: 'Zamanlanmış',
  PUBLISHED: 'Yayında',
  ARCHIVED: 'Arşiv',
  ACTIVE: 'Aktif',
  INACTIVE: 'Pasif',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function DashboardPage() {
  const { accessToken, activeTenantId, activeMallId, tenants, malls } = useAuth();
  const { can } = usePermission();
  const { has } = useCapability();

  const activeTenant = tenants.find((t) => t.id === activeTenantId);
  const activeMall = malls.find((m) => m.id === activeMallId);
  const canSwitch = tenants.length > 1 || malls.length > 1;
  const allowed = (permission: string, capability?: string) =>
    can(permission) && (!capability || has(capability));

  const ready = Boolean(accessToken && activeTenantId && activeMallId);
  const scope = `${activeTenantId}:${activeMallId}`;
  const token = accessToken ?? '';
  const tenantId = activeTenantId ?? '';
  const mallId = activeMallId ?? '';

  const canMessages = allowed('contact-message:read');
  const canCampaigns = allowed('campaign:read', 'campaigns');
  const canEvents = allowed('event:read', 'events');

  const summary = useScopedLoad(
    ready && can('content:read') ? `summary:${scope}` : null,
    () => apiDashboardSummary(token, tenantId, mallId),
  );
  const unread = useScopedLoad(ready && canMessages ? `unread:${scope}` : null, () =>
    contactMessagesCount(token, tenantId, mallId).then((r) => r.count),
  );
  const draftCampaigns = useScopedLoad(ready && canCampaigns ? `draft-c:${scope}` : null, () =>
    apiCampaignsList(token, tenantId, { mallId, status: 'DRAFT', limit: 1 }).then((r) => r.total),
  );
  const draftEvents = useScopedLoad(ready && canEvents ? `draft-e:${scope}` : null, () =>
    apiEventsList(token, tenantId, { mallId, status: 'DRAFT', limit: 1 }).then((r) => r.total),
  );
  const endingCampaigns = useScopedLoad(ready && canCampaigns ? `ending-c:${scope}` : null, () => {
    const now = new Date();
    const until = new Date(now.getTime() + ENDING_SOON_DAYS * 24 * 60 * 60 * 1000);
    // Same rules as the public site: visible now (PUBLISHED + publish window), this AVM
    // plus tenant-wide campaigns; endFrom/endTo filter the campaign's own end date.
    return apiCampaignsList(token, tenantId, {
      mallId,
      visibleNow: true,
      endFrom: now.toISOString(),
      endTo: until.toISOString(),
      limit: 5,
    }).then((r) => ({
      total: r.total,
      items: [...r.campaigns].sort((a, b) => String(a.campaignEndAt).localeCompare(String(b.campaignEndAt))),
    }));
  });

  if (!activeTenantId || !activeMallId) {
    return (
      <PageContainer>
        <h1 style={{ margin: '0 0 16px', fontSize: 22 }}>Gösterge Paneli</h1>
        <EmptyState
          title="Çalışma alanı seçin"
          description="Özetleri görmek için önce müşteri ve AVM seçin."
          action={
            <Link to="/select-tenant" style={{ color: '#2563eb' }}>
              Çalışma alanı seç
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const quickActions = [
    { label: '+ Kampanya ekle', href: '/campaigns?new=1', show: allowed('campaign:create', 'campaigns'), primary: true },
    { label: '+ Etkinlik ekle', href: '/events?new=1', show: allowed('event:create', 'events'), primary: true },
    { label: 'Slaytlar', href: '/sliders', show: allowed('slider:read', 'sliders') },
    { label: 'Açılır pencereler', href: '/popups', show: allowed('popup:read', 'popups') },
    { label: 'Medya kütüphanesi', href: '/media', show: allowed('media:read', 'media') },
    { label: 'İletişim mesajları', href: '/contact-messages', show: canMessages },
  ].filter((a) => a.show);

  const liveTiles = [
    { label: 'Yayındaki kampanyalar', key: 'activeCampaigns', href: '/campaigns', show: canCampaigns, helper: 'Ziyaretçiye şu an görünen (tüm AVM’lerde geçerli olanlar dahil)' },
    { label: 'Yaklaşan etkinlikler', key: 'upcomingEvents', href: '/events', show: canEvents, helper: 'Henüz başlamamış (tüm AVM’lerde geçerli olanlar dahil)' },
    { label: 'Yayındaki slaytlar', key: 'activeSliders', href: '/sliders', show: allowed('slider:read', 'sliders'), helper: 'Yayın tarihleri içinde' },
    { label: 'Yayındaki açılır pencereler', key: 'activePopups', href: '/popups', show: allowed('popup:read', 'popups'), helper: 'Yayın tarihleri içinde' },
    { label: 'Aktif mağazalar', key: 'totalStores', href: '/mall-stores', show: allowed('mall-store:read', 'stores'), helper: 'Bu AVM’de aktif' },
    { label: 'Hizmetler', key: 'servicesCount', href: '/services', show: allowed('service:read', 'location_services'), helper: 'Bu AVM’de aktif' },
  ] as const;
  const visibleTiles = liveTiles.filter((t) => t.show);

  const typeVisible = (type: DashboardTimelineType) =>
    allowed(TYPE_ACCESS[type].permission, TYPE_ACCESS[type].capability);

  const pendingEnabled = [unread, draftCampaigns, draftEvents, endingCampaigns].some(
    (l) => l.state.status !== 'disabled',
  );

  return (
    <PageContainer>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Gösterge Paneli
        </div>
        <h1 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 700, color: '#111827' }}>
          {activeMall?.name ?? 'AVM'}
        </h1>
        <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>{activeTenant?.name}</span>
          {canSwitch && (
            <Link to="/select-tenant" style={{ color: '#2563eb', textDecoration: 'none' }}>
              AVM değiştir
            </Link>
          )}
        </div>
      </header>

      {quickActions.length > 0 && (
        <section aria-labelledby="dash-quick" style={{ marginBottom: 20 }}>
          <h2 id="dash-quick" style={sectionTitle}>
            Hızlı işlemler
          </h2>
          <div className="cms-dash-actions">
            {quickActions.map((a) => (
              <Link key={a.href} to={a.href} style={a.primary ? primaryAction : secondaryAction}>
                {a.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="cms-dash-grid" style={{ marginBottom: 16 }}>
        {pendingEnabled && (
          <section className="cms-dash-card" aria-labelledby="dash-pending">
            <h2 id="dash-pending">Bekleyen işler</h2>
            <PendingList
              unread={unread}
              draftCampaigns={draftCampaigns}
              draftEvents={draftEvents}
              ending={endingCampaigns}
            />
          </section>
        )}

        {summary.state.status !== 'disabled' && visibleTiles.length > 0 && (
          <section className="cms-dash-card" aria-labelledby="dash-live">
            <h2 id="dash-live">Şu an sitede</h2>
            <div style={{ marginTop: 12 }}>
              {summary.state.status === 'error' ? (
                <ErrorRow message="Özet yüklenemedi." onRetry={summary.retry} />
              ) : (
                <div className="cms-dash-stats">
                  {visibleTiles.map((t) => (
                    <Link key={t.key} to={t.href} style={tileStyle}>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{t.label}</span>
                      <span style={{ fontSize: 24, fontWeight: 700, color: '#111827' }} aria-live="polite">
                        {summary.state.status === 'ready' ? summary.state.data[t.key] : '…'}
                      </span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{t.helper}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {summary.state.status !== 'disabled' && (
        <div className="cms-dash-grid">
          <section className="cms-dash-card" aria-labelledby="dash-upcoming">
            <h2 id="dash-upcoming">Yakında başlayacaklar</h2>
            <TimelineBody
              state={summary.state}
              onRetry={summary.retry}
              empty="Yakında başlayacak içerik yok."
              rows={
                summary.state.status === 'ready'
                  ? summary.state.data.upcomingContent
                      .filter((i) => typeVisible(i.type))
                      .map((i) => ({ id: `${i.type}-${i.id}`, href: i.href, type: i.type, title: i.title, meta: formatDate(i.scheduledAt) }))
                  : []
              }
            />
          </section>
          <section className="cms-dash-card" aria-labelledby="dash-recent">
            <h2 id="dash-recent">Son değişiklikler</h2>
            <TimelineBody
              state={summary.state}
              onRetry={summary.retry}
              empty="Henüz değişiklik yok."
              rows={
                summary.state.status === 'ready'
                  ? summary.state.data.recentActivity
                      .filter((i) => typeVisible(i.type))
                      .slice(0, 6)
                      .map((i) => ({
                        id: `${i.type}-${i.id}`,
                        href: i.href,
                        type: i.type,
                        title: i.title,
                        meta: [STATUS_LABELS[i.status] ?? i.status, formatDate(i.timestamp)].filter(Boolean).join(' · '),
                      }))
                  : []
              }
            />
          </section>
        </div>
      )}
    </PageContainer>
  );
}

const sectionTitle = { margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#111827' } as const;

const actionBase = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
} as const;
const primaryAction = { ...actionBase, background: '#2563eb', color: '#fff', border: '1px solid #2563eb' } as const;
const secondaryAction = { ...actionBase, background: '#fff', color: '#374151', border: '1px solid #d1d5db' } as const;

const tileStyle = {
  display: 'grid',
  gap: 4,
  padding: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'inherit',
  background: '#f9fafb',
} as const;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderTop: '1px solid #f3f4f6',
  fontSize: 13,
  textDecoration: 'none',
  color: '#111827',
} as const;

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#b91c1c', flexWrap: 'wrap' }}>
      <span>{message}</span>
      <Button size="sm" onClick={onRetry}>
        Tekrar dene
      </Button>
    </div>
  );
}

function PendingList({
  unread,
  draftCampaigns,
  draftEvents,
  ending,
}: {
  unread: { state: LoadState<number>; retry: () => void };
  draftCampaigns: { state: LoadState<number>; retry: () => void };
  draftEvents: { state: LoadState<number>; retry: () => void };
  ending: {
    state: LoadState<{ total: number; items: Array<{ id: string; title: string; campaignEndAt: string | null }> }>;
    retry: () => void;
  };
}) {
  const rows: ReactNode[] = [];
  const all = [unread, draftCampaigns, draftEvents, ending].filter((l) => l.state.status !== 'disabled');
  const loading = all.some((l) => l.state.status === 'loading');

  const countRow = (
    key: string,
    load: { state: LoadState<number>; retry: () => void },
    label: (n: number) => string,
    href: string,
    errorText: string,
  ) => {
    if (load.state.status === 'error') rows.push(<ErrorRow key={key} message={errorText} onRetry={load.retry} />);
    if (load.state.status === 'ready' && load.state.data > 0) {
      rows.push(
        <Link key={key} to={href} style={rowStyle}>
          <span>{label(load.state.data)}</span>
          <span aria-hidden="true" style={{ color: '#2563eb' }}>
            Görüntüle →
          </span>
        </Link>,
      );
    }
  };

  countRow('unread', unread, (n) => `${n} okunmamış iletişim mesajı`, '/contact-messages', 'Mesaj sayısı yüklenemedi.');
  countRow('draft-c', draftCampaigns, (n) => `${n} taslak kampanya`, '/campaigns', 'Taslak kampanyalar yüklenemedi.');
  countRow('draft-e', draftEvents, (n) => `${n} taslak etkinlik`, '/events', 'Taslak etkinlikler yüklenemedi.');

  if (ending.state.status === 'error') {
    rows.push(<ErrorRow key="ending" message="Bitmek üzere olan kampanyalar yüklenemedi." onRetry={ending.retry} />);
  }
  if (ending.state.status === 'ready' && ending.state.data.total > 0) {
    const { total, items } = ending.state.data;
    rows.push(
      <div key="ending" style={{ ...rowStyle, display: 'block' }}>
        <div style={{ marginBottom: 6 }}>
          Yayındaki {total} kampanya {ENDING_SOON_DAYS} gün içinde sona eriyor
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          {items.map((c) => (
            <li key={c.id} style={{ fontSize: 12, color: '#374151' }}>
              <Link to="/campaigns" style={{ color: '#111827' }}>
                {c.title}
              </Link>{' '}
              <span style={{ color: '#6b7280' }}>· bitiş {formatDate(c.campaignEndAt)}</span>
            </li>
          ))}
        </ul>
        {total > items.length && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>ve {total - items.length} kampanya daha</div>
        )}
      </div>,
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {rows}
      {loading && <p style={{ fontSize: 13, color: '#6b7280', margin: '10px 0 0' }}>Yükleniyor…</p>}
      {!loading && rows.length === 0 && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: '10px 0 0' }}>Şu an bekleyen iş yok.</p>
      )}
    </div>
  );
}

function TimelineBody({
  state,
  onRetry,
  rows,
  empty,
}: {
  state: LoadState<unknown>;
  onRetry: () => void;
  rows: Array<{ id: string; href: string; type: DashboardTimelineType; title: string; meta: string }>;
  empty: string;
}) {
  if (state.status === 'loading') return <p style={{ fontSize: 13, color: '#6b7280' }}>Yükleniyor…</p>;
  if (state.status === 'error') return <div style={{ marginTop: 12 }}><ErrorRow message="Liste yüklenemedi." onRetry={onRetry} /></div>;
  if (rows.length === 0) return <p style={{ fontSize: 13, color: '#6b7280' }}>{empty}</p>;
  return (
    <div style={{ marginTop: 8 }}>
      {rows.map((r) => (
        <Link key={r.id} to={r.href} style={rowStyle}>
          <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {TYPE_LABELS[r.type]}
              {r.meta ? ` · ${r.meta}` : ''}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
