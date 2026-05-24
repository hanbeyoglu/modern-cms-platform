import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { BrandAvatar } from '../components/ui/BrandAvatar';
import {
  formatLocationTypeLabel,
  formatStatusLabel,
  getMallBrandImageUrl,
  isPositiveStatus,
} from '../lib/branding';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f9fafb',
  padding: 24,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const panelStyle: React.CSSProperties = {
  width: 'min(960px, 100%)',
  display: 'grid',
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
  display: 'grid',
  gap: 14,
};

function statusStyle(status: string): React.CSSProperties {
  const positive = isPositiveStatus(status);

  return {
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: positive ? '#166534' : '#7f1d1d',
    background: positive ? '#dcfce7' : '#fee2e2',
    whiteSpace: 'nowrap',
  };
}

export function SelectLocationPage() {
  const { activeTenantId, tenants, malls, mallsLoading, activeMallId, selectMall } = useAuth();
  const navigate = useNavigate();
  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId);

  useEffect(() => {
    if (mallsLoading) return;

    if (malls.length === 1) {
      selectMall(malls[0].id);
      void navigate('/dashboard', { replace: true });
      return;
    }

  }, [malls, mallsLoading, navigate, selectMall]);

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, color: '#111827' }}>Lokasyon Seçin</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            {activeTenant
              ? `${activeTenant.name} için birden fazla lokasyon mevcut. Çalışmak istediğiniz lokasyonu seçin.`
              : 'Yönetim panelini açmadan önce çalışmak istediğiniz lokasyonu seçin.'}
          </p>
        </div>

        {mallsLoading ? (
          <div style={cardStyle}>Lokasyonlar yükleniyor…</div>
        ) : malls.length === 0 ? (
          <div style={cardStyle}>
            <strong>AVM/lokasyon bulunamadı</strong>
            <span style={{ color: '#6b7280' }}>
              Bu tenant için tanımlı AVM/lokasyon bulunamadı veya hesabınızın erişimi yok.
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {malls.map((mall) => {
              const imageUrl = getMallBrandImageUrl(mall);
              const typeLabel = formatLocationTypeLabel(mall.type);
              const selected = activeMallId === mall.id;

              return (
                <article key={mall.id} style={cardStyle}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <BrandAvatar
                      name={mall.name}
                      imageUrl={imageUrl}
                      size={52}
                      variant={mall.coverMedia && !mall.logoMedia ? 'square' : 'rounded'}
                    />
                    <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: 16, color: '#111827', display: 'block' }}>
                            {mall.name}
                          </strong>
                          <span style={{ color: '#6b7280', fontSize: 13 }}>{mall.slug}</span>
                        </div>
                        <span style={statusStyle(mall.status)}>{formatStatusLabel(mall.status)}</span>
                      </div>
                      {typeLabel ? (
                        <div style={{ color: '#4b5563', fontSize: 13 }}>{typeLabel}</div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={selected}
                    onClick={() => {
                      selectMall(mall.id);
                      void navigate('/dashboard', { replace: true });
                    }}
                    style={{
                      justifySelf: 'start',
                      border: '1px solid #2563eb',
                      background: selected ? '#eff6ff' : '#2563eb',
                      color: selected ? '#1d4ed8' : '#fff',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontWeight: 700,
                      cursor: selected ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                    }}
                  >
                    {selected ? 'Seçili' : 'Lokasyonu Seç'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
