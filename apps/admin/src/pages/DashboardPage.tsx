import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  apiSlidersList,
  apiEventsList,
  apiCampaignsList,
  apiGlobalStoresList,
} from '../lib/api';

type StatCard = {
  label: string;
  value: number | null;
  icon: string;
  href: string;
};

function StatCard({ label, value, icon }: StatCard) {
  return (
    <div
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: '#eff6ff',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1 }}>
          {value === null ? (
            <span style={{ fontSize: 16, color: '#9ca3af' }}>—</span>
          ) : (
            value.toLocaleString('tr-TR')
          )}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { accessToken, activeTenantId, activeMallId, user, tenants, malls } = useAuth();
  const activeTenant = tenants.find((t) => t.id === activeTenantId);
  const activeMall = malls.find((m) => m.id === activeMallId);

  const [stats, setStats] = useState<{
    sliders: number | null;
    events: number | null;
    campaigns: number | null;
    stores: number | null;
  }>({ sliders: null, events: null, campaigns: null, stores: null });

  useEffect(() => {
    if (!accessToken || !activeTenantId) return;

    const mallId = activeMallId ?? undefined;

    async function fetchStats() {
      try {
        const [slidersRes, eventsRes, campaignsRes, storesRes] = await Promise.allSettled([
          apiSlidersList(accessToken!, activeTenantId!, { mallId, limit: 1 }),
          apiEventsList(accessToken!, activeTenantId!, { mallId, limit: 1 }),
          apiCampaignsList(accessToken!, activeTenantId!, { mallId, limit: 1 }),
          apiGlobalStoresList(accessToken!, activeTenantId!, { limit: 1 }),
        ]);

        setStats({
          sliders: slidersRes.status === 'fulfilled' ? slidersRes.value.total : null,
          events: eventsRes.status === 'fulfilled' ? eventsRes.value.total : null,
          campaigns: campaignsRes.status === 'fulfilled' ? campaignsRes.value.total : null,
          stores: storesRes.status === 'fulfilled' ? storesRes.value.total : null,
        });
      } catch {
        /* ignore — individual settled promises handle errors */
      }
    }

    void fetchStats();
  }, [accessToken, activeTenantId, activeMallId]);

  const contextLabel = [activeTenant?.name, activeMall?.name].filter(Boolean).join(' › ');

  return (
    <PageContainer>
      <PageHeader
        title="Gösterge Paneli"
        subtitle={contextLabel || 'Tenant seçin'}
      />

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
        <>
          {/* Stat cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 28,
            }}
          >
            <StatCard label="Slider" value={stats.sliders} icon="▦" href="/sliders" />
            <StatCard label="Etkinlik" value={stats.events} icon="◷" href="/events" />
            <StatCard label="Kampanya" value={stats.campaigns} icon="◈" href="/campaigns" />
            <StatCard label="Global Mağaza" value={stats.stores} icon="▣" href="/global-stores" />
          </div>

          {/* User / tenant info */}
          {user && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              <section
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '16px 20px',
                  fontSize: 13,
                }}
              >
                <h2 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>Oturum</h2>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div><span style={{ color: '#6b7280' }}>E-posta:</span> {user.email}</div>
                  <div><span style={{ color: '#6b7280' }}>Durum:</span> {user.status}</div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Rol:</span>{' '}
                    {user.isSuperAdmin ? 'Super Admin' : 'Tenant Üyesi'}
                  </div>
                </div>
              </section>

              <section
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '16px 20px',
                  fontSize: 13,
                }}
              >
                <h2 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>
                  Aktif Bağlam
                </h2>
                <div style={{ display: 'grid', gap: 4 }}>
                  {activeTenant && (
                    <div>
                      <span style={{ color: '#6b7280' }}>Tenant:</span> {activeTenant.name}
                    </div>
                  )}
                  {activeMall && (
                    <div>
                      <span style={{ color: '#6b7280' }}>Mall:</span> {activeMall.name}
                    </div>
                  )}
                  {!activeMall && (
                    <div style={{ color: '#9ca3af' }}>Tüm malllar görüntüleniyor</div>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
