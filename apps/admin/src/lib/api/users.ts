import { request } from './client';

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'INVITED';

export type UserMembership = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: { id: string; code: string; name: string };
  isActive: boolean;
  malls: Array<{ id: string; name: string; slug: string }>;
  createdAt: string;
};

export type CmsUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  memberships: UserMembership[];
};

export type UserListResponse = { users: CmsUser[] };

export type CreateUserPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
  tenantId?: string;
  roleId?: string;
  mallIds?: string[];
};

export type CreateMembershipPayload = {
  tenantId: string;
  roleId: string;
  mallIds?: string[];
};

export type UpdateMembershipPayload = {
  roleId?: string;
  mallIds?: string[];
  isActive?: boolean;
};

export function apiUsersList(
  token: string,
  params?: {
    search?: string;
    roleId?: string;
    tenantId?: string;
    mallId?: string;
    status?: string;
  },
): Promise<UserListResponse> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.roleId) qs.set('roleId', params.roleId);
  if (params?.tenantId) qs.set('tenantId', params.tenantId);
  if (params?.mallId) qs.set('mallId', params.mallId);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/users${suffix}`, { token });
}

export function apiUserGet(token: string, id: string): Promise<CmsUser> {
  return request(`/users/${id}`, { token });
}

export function apiUserCreate(token: string, data: CreateUserPayload): Promise<CmsUser> {
  return request('/users', { method: 'POST', body: JSON.stringify(data), token });
}

export function apiUserUpdate(
  token: string,
  id: string,
  data: { firstName?: string; lastName?: string },
): Promise<CmsUser> {
  return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data), token });
}

export function apiUserUpdateStatus(
  token: string,
  id: string,
  status: 'ACTIVE' | 'DISABLED',
): Promise<{ success: boolean; status: string }> {
  return request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }), token });
}

export function apiUserAddMembership(
  token: string,
  userId: string,
  data: CreateMembershipPayload,
): Promise<{ success: boolean; membershipId: string }> {
  return request(`/users/${userId}/memberships`, { method: 'POST', body: JSON.stringify(data), token });
}

export function apiUserUpdateMembership(
  token: string,
  userId: string,
  membershipId: string,
  data: UpdateMembershipPayload,
): Promise<{ success: boolean }> {
  return request(`/users/${userId}/memberships/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export function apiUserRemoveMembership(
  token: string,
  userId: string,
  membershipId: string,
): Promise<{ success: boolean }> {
  return request(`/users/${userId}/memberships/${membershipId}`, { method: 'DELETE', token });
}

export function apiUserResetPassword(
  token: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  return request(`/users/${userId}/reset-password`, { method: 'POST', token });
}
