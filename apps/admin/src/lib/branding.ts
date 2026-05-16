import type { Mall, Tenant } from './api';
import { LOCATION_TYPE_LABELS, type LocationType } from './api/locations';

export type BrandMedia = { id: string; publicUrl: string };

export function getMallBrandImageUrl(mall: Pick<Mall, 'logoMedia' | 'coverMedia'>): string | null {
  return mall.logoMedia?.publicUrl ?? mall.coverMedia?.publicUrl ?? null;
}

export function getTenantBrandImageUrl(tenant: Pick<Tenant, 'logoUrl'>): string | null {
  const url = tenant.logoUrl?.trim();
  return url || null;
}

export function resolveSidebarBrandImage(
  activeTenant: Tenant | undefined,
  activeMall: Mall | undefined,
): string | null {
  if (activeMall) {
    const mallImage = getMallBrandImageUrl(activeMall);
    if (mallImage) return mallImage;
  }
  if (activeTenant) {
    return getTenantBrandImageUrl(activeTenant);
  }
  return null;
}

export function formatContextLabel(
  activeTenant: Tenant | undefined,
  activeMall: Mall | undefined,
): string {
  if (activeTenant && activeMall) return `${activeTenant.name} · ${activeMall.name}`;
  if (activeTenant) return activeTenant.name;
  if (activeMall) return activeMall.name;
  return 'Bağlam seçilmedi';
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export function isPositiveStatus(status: string): boolean {
  const normalized = status.toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'LIVE';
}

export function formatLocationTypeLabel(type?: string | null): string | null {
  if (!type) return null;
  return LOCATION_TYPE_LABELS[type as LocationType] ?? type.replace(/_/g, ' ');
}

export function resolveSidebarBrandName(
  activeTenant: Tenant | undefined,
  activeMall: Mall | undefined,
): string {
  if (activeMall) return activeMall.name;
  if (activeTenant) return activeTenant.name;
  return '';
}
