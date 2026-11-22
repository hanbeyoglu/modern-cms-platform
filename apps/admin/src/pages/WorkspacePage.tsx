import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { BrandAvatar } from '../components/ui/BrandAvatar';
import {
  formatLocationTypeLabel,
  formatStatusLabel,
  getMallBrandImageUrl,
  getTenantBrandImageUrl,
  isPositiveStatus,
} from '../lib/branding';
import type { Mall, Tenant } from '../lib/api';

// ─── Workspace history ────────────────────────────────────────────────────────
const WORKSPACE_HISTORY_KEY = 'modern-cms.admin.workspace-history';

type WorkspaceHistory = {
  tenantId: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  mallId: string;
  mallName: string;
};

function loadWorkspaceHistory(): WorkspaceHistory | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_HISTORY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceHistory;
  } catch {
    return null;
  }
}

function saveWorkspaceHistory(data: WorkspaceHistory): void {
  try {
    localStorage.setItem(WORKSPACE_HISTORY_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isTenantDisabled(tenant: Tenant): boolean {
  const s = tenant.status.toUpperCase();
  return s === 'DISABLED' || s === 'ARCHIVED';
}

function getMallCountForTenant(
  user: { isSuperAdmin: boolean; memberships?: Array<{ tenantId: string; malls: unknown[] }> } | null,
  tenantId: string,
): number | null {
  if (!user || user.isSuperAdmin) return null;
  const m = user.memberships?.find((x) => x.tenantId === tenantId);
  return m ? m.malls.length : null;
}

// ─── CSS (keyframes + responsive grid + interactive classes) ──────────────────
const WORKSPACE_CSS = `
  @keyframes ws-fadein {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes ws-shimmer {
    from { background-position: -400px 0; }
    to   { background-position:  400px 0; }
  }
  @keyframes ws-slide-down {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0);    }
  }

  .ws-card {
    background: #ffffff;
    border: 2px solid #e5e7eb;
    border-radius: 16px;
    padding: 20px;
    cursor: pointer;
    transition: border-color 0.14s ease, box-shadow 0.14s ease, transform 0.12s ease;
    outline: none;
    text-align: left;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
    animation: ws-fadein 0.22s ease both;
  }
  .ws-card:hover:not([disabled]):not(.ws-card--disabled) {
    border-color: #93c5fd;
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.10);
    transform: translateY(-3px);
  }
  .ws-card--selected {
    border-color: #2563eb !important;
    box-shadow: 0 6px 24px rgba(37, 99, 235, 0.18) !important;
    background: #fafcff !important;
  }
  .ws-card--disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .ws-card:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.22);
  }

  .ws-skeleton {
    background: linear-gradient(90deg, #f0f2f5 25%, #e4e7ec 50%, #f0f2f5 75%);
    background-size: 400px 100%;
    animation: ws-shimmer 1.4s infinite linear;
    border-radius: 6px;
  }

  .ws-quick-card {
    background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
    border: 1.5px solid #bfdbfe;
    border-radius: 14px;
    padding: 14px 20px;
    cursor: pointer;
    transition: border-color 0.14s, box-shadow 0.14s;
    outline: none;
    text-align: left;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .ws-quick-card:hover {
    border-color: #2563eb;
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.12);
  }
  .ws-quick-card:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.22);
  }

  .ws-search {
    width: 100%;
    padding: 11px 16px 11px 44px;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    font-size: 14px;
    font-family: inherit;
    color: #111827;
    background: #fff;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.14s, box-shadow 0.14s;
  }
  .ws-search:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
  }
  .ws-search::placeholder { color: #9ca3af; }

  .ws-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 9px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.12s, color 0.12s;
    outline: none;
  }
  .ws-back-btn:hover {
    border-color: #2563eb;
    color: #2563eb;
  }
  .ws-back-btn:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
  }

  .ws-primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 11px 22px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.12s, box-shadow 0.12s;
    outline: none;
  }
  .ws-primary-btn:hover { background: #1d4ed8; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3); }
  .ws-primary-btn:focus-visible { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3); }

  .ws-logout-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.12s, color 0.12s;
    outline: none;
  }
  .ws-logout-btn:hover { border-color: #dc2626; color: #dc2626; }

  .ws-tenant-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(4, 1fr);
  }
  .ws-mall-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(4, 1fr);
  }
  .ws-mall-section {
    animation: ws-slide-down 0.22s ease both;
  }
  @media (max-width: 1100px) {
    .ws-tenant-grid, .ws-mall-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 620px) {
    .ws-tenant-grid, .ws-mall-grid { grid-template-columns: 1fr; }
  }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
        }}
      >
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px' }}>C</span>
      </div>
      <span style={{ fontWeight: 800, fontSize: 16, color: '#111827', letterSpacing: '-0.3px' }}>
        Modern CMS
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const positive = isPositiveStatus(status);
  return (
    <span
      style={{
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: positive ? '#15803d' : '#92400e',
        background: positive ? '#dcfce7' : '#fef3c7',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#6b7280',
      }}
    >
      {children}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: '#fff',
        border: '2px solid #e5e7eb',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="ws-skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
        <div className="ws-skeleton" style={{ width: 52, height: 18, borderRadius: 999 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="ws-skeleton" style={{ height: 16, width: '65%' }} />
        <div className="ws-skeleton" style={{ height: 12, width: '40%' }} />
      </div>
      <div className="ws-skeleton" style={{ height: 12, width: '50%' }} />
    </div>
  );
}

function EmptyTenants({ isSuperAdmin, onCreateTenant }: { isSuperAdmin: boolean; onCreateTenant: () => void }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '2px dashed #e5e7eb',
        borderRadius: 20,
        padding: '60px 40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        animation: 'ws-fadein 0.25s ease both',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
          border: '2px solid #bfdbfe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
        }}
      >
        🏢
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#111827', marginBottom: 6 }}>
          Henüz Tenant Bulunmuyor
        </div>
        <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 320, lineHeight: 1.6 }}>
          Modern CMS'i kullanmaya başlamak için ilk tenantınızı oluşturun.
        </div>
      </div>
      {isSuperAdmin && (
        <button type="button" className="ws-primary-btn" onClick={onCreateTenant}>
          <span>+</span> Tenant Oluştur
        </button>
      )}
    </div>
  );
}

function EmptyMalls({ isSuperAdmin, onCreateMall }: { isSuperAdmin: boolean; onCreateMall: () => void }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '2px dashed #e5e7eb',
        borderRadius: 20,
        padding: '48px 40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        animation: 'ws-fadein 0.25s ease both',
        marginTop: 10,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #f0fdf4, #eff6ff)',
          border: '2px solid #bbf7d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        🏬
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#111827', marginBottom: 6 }}>
          Henüz AVM Bulunmuyor
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 280, lineHeight: 1.6 }}>
          Bu tenant altında ilk AVM'nizi oluşturun.
        </div>
      </div>
      {isSuperAdmin && (
        <button type="button" className="ws-primary-btn" onClick={onCreateMall}>
          <span>+</span> AVM Oluştur
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function WorkspacePage() {
  const { tenants, user, activeTenantId, malls, mallsLoading, mallsError, activeMallId, selectTenant, selectMall, profileLoading, clearSession } =
    useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [lastUsed] = useState<WorkspaceHistory | null>(loadWorkspaceHistory);
  const [step, setStep] = useState<'tenant' | 'mall'>(() => (activeTenantId ? 'mall' : 'tenant'));

  const tenantGridRef = useRef<HTMLDivElement>(null);
  const mallGridRef = useRef<HTMLDivElement>(null);

  // Advance only when the active tenant changes, not when the user goes back.
  const previousTenantId = useRef(activeTenantId);
  useEffect(() => {
    const changed = previousTenantId.current !== activeTenantId;
    previousTenantId.current = activeTenantId;
    if (changed && activeTenantId) {
      setStep('mall');
      setSearch('');
    }
  }, [activeTenantId]);

  // Auto-advance single tenant (non-super-admins)
  useEffect(() => {
    if (!user?.isSuperAdmin && tenants.length === 1 && !isTenantDisabled(tenants[0]!)) {
      selectTenant(tenants[0]!.id);
    }
  }, [selectTenant, tenants, user?.isSuperAdmin]);

  // Auto-advance single mall
  useEffect(() => {
    if (step !== 'mall' || mallsLoading || activeMallId) return;
    if (malls.length === 1) {
      const mall = malls[0]!;
      const activeTenant = tenants.find((t) => t.id === activeTenantId);
      selectMall(mall.id);
      if (activeTenant) {
        saveWorkspaceHistory({
          tenantId: activeTenant.id,
          tenantName: activeTenant.name,
          tenantLogoUrl: getTenantBrandImageUrl(activeTenant),
          mallId: mall.id,
          mallName: mall.name,
        });
      }
      void navigate('/dashboard', { replace: true });
    }
  }, [step, malls, mallsLoading, activeMallId, activeTenantId, tenants, navigate, selectMall]);

  const activeTenant = tenants.find((t) => t.id === activeTenantId);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [tenants, search]);

  const filteredMalls = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return malls;
    return malls.filter((m) => m.name.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q));
  }, [malls, search]);

  const showLastUsed =
    step === 'tenant' && lastUsed != null && tenants.some((t) => t.id === lastUsed.tenantId);

  const handleTenantSelect = useCallback(
    (tenant: Tenant) => {
      if (isTenantDisabled(tenant)) return;
      selectTenant(tenant.id);
      setStep('mall');
      setSearch('');
    },
    [selectTenant],
  );

  const handleMallSelect = useCallback(
    (mall: Mall) => {
      selectMall(mall.id);
      if (activeTenant) {
        saveWorkspaceHistory({
          tenantId: activeTenant.id,
          tenantName: activeTenant.name,
          tenantLogoUrl: getTenantBrandImageUrl(activeTenant),
          mallId: mall.id,
          mallName: mall.name,
        });
      }
      void navigate('/dashboard', { replace: true });
    },
    [selectMall, navigate, activeTenant],
  );

  const handleLastUsed = useCallback(() => {
    if (!lastUsed) return;
    selectTenant(lastUsed.tenantId);
    selectMall(lastUsed.mallId);
    void navigate('/dashboard', { replace: true });
  }, [lastUsed, selectTenant, selectMall, navigate]);

  const handleBackToTenant = useCallback(() => {
    setStep('tenant');
    setSearch('');
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    void navigate('/login', { replace: true });
  }, [clearSession, navigate]);

  // Keyboard navigation
  function handleGridKeyDown(
    e: React.KeyboardEvent,
    idx: number,
    gridRef: React.RefObject<HTMLDivElement | null>,
    onEsc?: () => void,
  ) {
    const cards = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>('button.ws-card') ?? []);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      cards[idx + 1]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      cards[idx - 1]?.focus();
    } else if (e.key === 'Escape' && onEsc) {
      e.preventDefault();
      onEsc();
    }
  }

  // ── Loading skeleton ──
  if (profileLoading) {
    return (
      <main style={pageStyle}>
        <style>{WORKSPACE_CSS}</style>
        <div style={containerStyle}>
          <PageHeader onLogout={handleLogout} userEmail={user?.email ?? ''} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="ws-skeleton" style={{ height: 28, width: 200 }} />
            <div className="ws-skeleton" style={{ height: 16, width: 300 }} />
          </div>
          <div className="ws-tenant-grid">
            {[0, 1, 2, 3].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── No tenants: empty state ──
  if (tenants.length === 0) {
    return (
      <main style={pageStyle}>
        <style>{WORKSPACE_CSS}</style>
        <div style={containerStyle}>
          <PageHeader onLogout={handleLogout} userEmail={user?.email ?? ''} />
          <PageHeading
            step={step}
            activeTenantName={activeTenant?.name}
          />
          <EmptyTenants
            isSuperAdmin={user?.isSuperAdmin ?? false}
            onCreateTenant={() => void navigate('/tenants')}
          />
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <style>{WORKSPACE_CSS}</style>
      <div style={containerStyle}>
        {/* Top bar: logo + user */}
        <PageHeader onLogout={handleLogout} userEmail={user?.email ?? ''} />

        {/* Title */}
        <PageHeading step={step} activeTenantName={activeTenant?.name} />

        {/* Last used */}
        {showLastUsed && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                  boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.2)',
                }}
              />
              Son Çalışılan
            </SectionLabel>
            <button type="button" className="ws-quick-card" onClick={handleLastUsed}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <BrandAvatar name={lastUsed!.tenantName} imageUrl={lastUsed!.tenantLogoUrl} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a8a', marginBottom: 2 }}>
                    {lastUsed!.tenantName}
                  </div>
                  <div style={{ fontSize: 12, color: '#3b82f6' }}>{lastUsed!.mallName}</div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#2563eb',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Devam Et
                  <span style={{ fontSize: 15 }}>→</span>
                </div>
              </div>
            </button>
          </section>
        )}

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              pointerEvents: 'none',
              width: 17,
              height: 17,
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="ws-search"
            placeholder={step === 'tenant' ? 'Tenant ara...' : 'AVM ara...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ── Tenant step ── */}
        {step === 'tenant' && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionLabel>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#2563eb',
                  display: 'inline-block',
                }}
              />
              Tenantlar
              <span style={{ marginLeft: 'auto', fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: '#9ca3af', fontSize: 12 }}>
                {filteredTenants.length} sonuç
              </span>
            </SectionLabel>

            {filteredTenants.length === 0 ? (
              <NoResults query={search} />
            ) : (
              <div className="ws-tenant-grid" ref={tenantGridRef}>
                {filteredTenants.map((tenant, idx) => {
                  const disabled = isTenantDisabled(tenant);
                  const selected = activeTenantId === tenant.id;
                  const logoUrl = getTenantBrandImageUrl(tenant);
                  const mallCount = getMallCountForTenant(user, tenant.id);

                  return (
                    <button
                      key={tenant.id}
                      type="button"
                      className={[
                        'ws-card',
                        selected ? 'ws-card--selected' : '',
                        disabled ? 'ws-card--disabled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={disabled}
                      onClick={() => handleTenantSelect(tenant)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, tenantGridRef)}
                      style={{ animationDelay: `${idx * 0.04}s` }}
                    >
                      <TenantCardContent
                        tenant={tenant}
                        logoUrl={logoUrl}
                        mallCount={mallCount}
                        selected={selected}
                        disabled={disabled}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Mall step ── */}
        {step === 'mall' && activeTenantId && (
          <div className="ws-mall-section">
            {/* Back + active tenant breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <button type="button" className="ws-back-btn" onClick={handleBackToTenant}>
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Tenantlar
              </button>
              {activeTenant && (
                <>
                  <span style={{ color: '#d1d5db', fontSize: 16 }}>/</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BrandAvatar
                      name={activeTenant.name}
                      imageUrl={getTenantBrandImageUrl(activeTenant)}
                      size={26}
                    />
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                      {activeTenant.name}
                    </span>
                    <StatusBadge status={activeTenant.status} />
                  </div>
                </>
              )}
            </div>

            <SectionLabel>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#059669',
                  display: 'inline-block',
                }}
              />
              AVM Seçin
              {!mallsLoading && (
                <span style={{ marginLeft: 'auto', fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: '#9ca3af', fontSize: 12 }}>
                  {filteredMalls.length} AVM
                </span>
              )}
            </SectionLabel>

            {mallsLoading ? (
              <div className="ws-mall-grid" style={{ marginTop: 10 }}>
                {[0, 1, 2].map((n) => (
                  <SkeletonCard key={n} />
                ))}
              </div>
            ) : mallsError ? (
              <div
                style={{
                  marginTop: 10,
                  padding: '16px 20px',
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: 12,
                  color: '#dc2626',
                  fontSize: 14,
                }}
              >
                AVM'ler yüklenemedi: {mallsError}
              </div>
            ) : malls.length === 0 ? (
              <EmptyMalls
                isSuperAdmin={user?.isSuperAdmin ?? false}
                onCreateMall={() => void navigate('/locations')}
              />
            ) : filteredMalls.length === 0 ? (
              <NoResults query={search} />
            ) : (
              <div className="ws-mall-grid" style={{ marginTop: 10 }} ref={mallGridRef}>
                {filteredMalls.map((mall, idx) => {
                  const selected = activeMallId === mall.id;
                  const imageUrl = getMallBrandImageUrl(mall);
                  const typeLabel = formatLocationTypeLabel(mall.type);

                  return (
                    <button
                      key={mall.id}
                      type="button"
                      className={['ws-card', selected ? 'ws-card--selected' : ''].filter(Boolean).join(' ')}
                      onClick={() => handleMallSelect(mall)}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, mallGridRef, handleBackToTenant)}
                      style={{ animationDelay: `${idx * 0.04}s` }}
                    >
                      <MallCardContent
                        mall={mall}
                        imageUrl={imageUrl}
                        typeLabel={typeLabel}
                        selected={selected}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Card content components ──────────────────────────────────────────────────

function TenantCardContent({
  tenant,
  logoUrl,
  mallCount,
  selected,
  disabled,
}: {
  tenant: Tenant;
  logoUrl: string | null;
  mallCount: number | null;
  selected: boolean;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <BrandAvatar name={tenant.name} imageUrl={logoUrl} size={46} />
        <StatusBadge status={tenant.status} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', marginBottom: 3, lineHeight: 1.3 }}>
          {tenant.name}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{tenant.slug}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {mallCount !== null ? (
          <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>🏬</span>
            {mallCount} AVM
          </div>
        ) : (
          <div />
        )}
        {selected && !disabled && (
          <div
            style={{
              fontSize: 11,
              color: '#2563eb',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#2563eb',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              ✓
            </span>
            Seçili
          </div>
        )}
      </div>
    </div>
  );
}

function MallCardContent({
  mall,
  imageUrl,
  typeLabel,
  selected,
}: {
  mall: Mall;
  imageUrl: string | null;
  typeLabel: string | null;
  selected: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <BrandAvatar
          name={mall.name}
          imageUrl={imageUrl}
          size={46}
          variant={mall.coverMedia && !mall.logoMedia ? 'square' : 'rounded'}
        />
        <StatusBadge status={mall.status} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', marginBottom: 3, lineHeight: 1.3 }}>
          {mall.name}
        </div>
        {typeLabel ? (
          <div style={{ fontSize: 12, color: '#6b7280' }}>{typeLabel}</div>
        ) : (
          <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{mall.slug}</div>
        )}
      </div>
      {selected && (
        <div
          style={{
            fontSize: 11,
            color: '#2563eb',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#2563eb',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 900,
            }}
          >
            ✓
          </span>
          Seçili
        </div>
      )}
    </div>
  );
}

// ─── Shared layout bits ───────────────────────────────────────────────────────

function PageHeader({ onLogout, userEmail }: { onLogout: () => void; userEmail: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Logo />
      {userEmail && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{userEmail}</span>
          <button type="button" className="ws-logout-btn" onClick={onLogout}>
            Çıkış
          </button>
        </div>
      )}
    </div>
  );
}

function PageHeading({
  step,
  activeTenantName,
}: {
  step: 'tenant' | 'mall';
  activeTenantName?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 900,
          color: '#111827',
          letterSpacing: '-0.5px',
          lineHeight: 1.2,
        }}
      >
        Çalışma Alanı Seç
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
        {step === 'tenant'
          ? 'Hangi tenant ve AVM üzerinde çalışmak istediğinizi seçin.'
          : activeTenantName
            ? `${activeTenantName} için bir AVM seçin.`
            : 'Çalışmak istediğiniz AVM\'yi seçin.'}
      </p>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div
      style={{
        padding: '24px 20px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 14,
        background: '#f9fafb',
        borderRadius: 12,
        border: '1px dashed #e5e7eb',
      }}
    >
      <span style={{ fontSize: 20, display: 'block', marginBottom: 8 }}>🔍</span>
      <strong style={{ color: '#374151' }}>"{query}"</strong> ile eşleşen sonuç bulunamadı.
    </div>
  );
}

// ─── Page styles ──────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  background: 'linear-gradient(160deg, #f8fafc 0%, #eff4ff 50%, #f0fdf8 100%)',
  padding: '40px 24px 80px',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

const containerStyle: React.CSSProperties = {
  width: 'min(1080px, 100%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
};
