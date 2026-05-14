import { request } from './client';

export type RolePermission = {
  id: string;
  code: string;
  description: string | null;
};

export type CmsRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  tenantId: string | null;
  isSystem: boolean;
  isActive: boolean;
  usageCount: number;
  permissions: RolePermission[];
  createdAt: string;
  updatedAt: string;
};

export type RoleListResponse = { roles: CmsRole[] };

export type PermissionGroup = Record<string, RolePermission[]>;

export type PermissionsResponse = {
  permissions: RolePermission[];
  groups: PermissionGroup;
};

export function apiRolesList(token: string, tenantId?: string): Promise<RoleListResponse> {
  const qs = tenantId ? `?tenantId=${tenantId}` : '';
  return request(`/roles${qs}`, { token });
}

export function apiRoleGet(token: string, id: string): Promise<CmsRole> {
  return request(`/roles/${id}`, { token });
}

export function apiRoleCreate(
  token: string,
  data: { name: string; description?: string; permissionIds?: string[] },
): Promise<CmsRole> {
  return request('/roles', { method: 'POST', body: JSON.stringify(data), token });
}

export function apiRoleUpdate(
  token: string,
  id: string,
  data: { name?: string; description?: string; isActive?: boolean },
): Promise<CmsRole> {
  return request(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data), token });
}

export function apiRoleUpdatePermissions(
  token: string,
  id: string,
  permissionIds: string[],
): Promise<CmsRole> {
  return request(`/roles/${id}/permissions`, {
    method: 'PATCH',
    body: JSON.stringify({ permissionIds }),
    token,
  });
}

export function apiRoleClone(token: string, id: string, name: string): Promise<CmsRole> {
  return request(`/roles/${id}/clone`, { method: 'POST', body: JSON.stringify({ name }), token });
}

export function apiRoleDelete(token: string, id: string): Promise<{ success: boolean }> {
  return request(`/roles/${id}`, { method: 'DELETE', token });
}

export function apiPermissionsList(token: string): Promise<PermissionsResponse> {
  return request('/roles/permissions', { token });
}
