import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { confirmDiscardUnsavedChanges } from '../lib/unsaved-changes';
import { resolveSidebarBrandImage, resolveSidebarBrandName } from '../lib/branding';
import { BrandAvatar } from './ui/BrandAvatar';

/**
 * Header workspace switcher: shows which tenant / AVM the user is working in
 * and lets them switch (guarded against unsaved form edits).
 */
export function TenantMallSelector() {
  const { tenants, activeTenantId, malls, activeMallId, mallsLoading, selectTenant, selectMall } =
    useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId);
  const activeMall = malls.find((mall) => mall.id === activeMallId);
  const canSwitch = tenants.length > 1 || malls.length > 1;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    wrapperRef.current?.querySelector<HTMLElement>('select, a')?.focus();
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  if (tenants.length === 0) return null;

  const primary = activeMall?.name ?? activeTenant?.name ?? 'Çalışma alanı seçin';
  const secondary = activeMall ? activeTenant?.name : activeTenant ? 'AVM seçilmedi' : '';
  const brandName = resolveSidebarBrandName(activeTenant, activeMall) || primary;

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  return (
    <div
      className="cms-workspace"
      ref={wrapperRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="cms-workspace__button"
        aria-label={`Çalışma alanı: ${[activeTenant?.name, activeMall?.name].filter(Boolean).join(', ')}${canSwitch ? '. Değiştirmek için açın' : ''}`}
        aria-expanded={canSwitch ? open : undefined}
        aria-controls={canSwitch ? panelId : undefined}
        disabled={!canSwitch}
        onClick={() => setOpen((v) => !v)}
      >
        <BrandAvatar name={brandName} imageUrl={resolveSidebarBrandImage(activeTenant, activeMall)} size={30} />
        <span className="cms-workspace__text">
          <span className="cms-workspace__mall">{primary}</span>
          {secondary && <span className="cms-workspace__tenant">{secondary}</span>}
        </span>
        {canSwitch && (
          <span aria-hidden="true" style={{ fontSize: 10, color: '#6b7280' }}>
            ▼
          </span>
        )}
      </button>

      {open && (
        <div className="cms-workspace__panel" id={panelId} role="group" aria-label="Çalışma alanını değiştir">
          {tenants.length > 1 && (
            <label>
              Müşteri (tenant)
              <select
                value={activeTenantId ?? ''}
                onChange={(e) => {
                  if (!confirmDiscardUnsavedChanges()) return;
                  selectTenant(e.target.value);
                }}
              >
                {!activeTenantId && <option value="">— Seçin —</option>}
                {tenants.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.status.toUpperCase() === 'DISABLED'}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {activeTenantId && mallsLoading && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>AVM bilgileri yükleniyor…</span>
          )}
          {activeTenantId && !mallsLoading && malls.length === 0 && (
            <span style={{ fontSize: 12, color: '#b45309' }}>Bu müşteri için tanımlı AVM bulunamadı.</span>
          )}
          {activeTenantId && !mallsLoading && malls.length > 1 && (
            <label>
              AVM
              <select
                value={activeMallId ?? ''}
                onChange={(e) => {
                  if (!confirmDiscardUnsavedChanges()) return;
                  selectMall(e.target.value || null);
                  close(true);
                }}
              >
                {!activeMallId && <option value="">— Seçin —</option>}
                {malls.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <Link
            to="/select-tenant"
            onClick={() => close(false)}
            style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}
          >
            Tüm çalışma alanlarını göster
          </Link>
        </div>
      )}
    </div>
  );
}
