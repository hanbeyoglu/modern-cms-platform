import { request } from './client';

export type GeneralSettings = {
  displayName: string;
  timezone: string;
  defaultLocale: string;
  supportEmail: string;
  logoUrl: string;
};

export type SecuritySettings = {
  sessionTimeoutMinutes: number;
  allowPublicRegistration: boolean;
  maintenanceMode: boolean;
  passwordPolicy: string;
};

export type TenantSettings = {
  tenantId: string;
  general: GeneralSettings;
  security: SecuritySettings;
};

export function apiSettingsGet(token: string, tenantId: string): Promise<TenantSettings> {
  return request(`/tenants/${tenantId}/settings`, { token });
}

export function apiSettingsUpdateGeneral(
  token: string,
  tenantId: string,
  data: Partial<GeneralSettings>,
): Promise<TenantSettings> {
  return request(`/tenants/${tenantId}/settings/general`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export function apiSettingsUpdateSecurity(
  token: string,
  tenantId: string,
  data: Partial<SecuritySettings>,
): Promise<TenantSettings> {
  return request(`/tenants/${tenantId}/settings/security`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}
