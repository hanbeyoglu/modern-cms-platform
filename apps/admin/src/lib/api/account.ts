import { request } from './client';
import type { MeResponse } from './auth';

export function apiUpdateProfile(
  token: string,
  data: { firstName?: string; lastName?: string },
): Promise<MeResponse> {
  return request('/auth/me', { method: 'PATCH', body: JSON.stringify(data), token });
}

export function apiChangePassword(
  token: string,
  data: { currentPassword: string; newPassword: string },
): Promise<{ success: boolean }> {
  return request('/auth/change-password', { method: 'POST', body: JSON.stringify(data), token });
}
