import { appendLimitParam } from './constants';
import { request } from './client';

export type NotificationType = 'SYSTEM' | 'CONTENT' | 'SCHEDULING' | 'ANALYTICS' | 'SECURITY';
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type CmsNotification = {
  id: string;
  tenantId: string | null;
  mallId: string | null;
  userId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  severity: NotificationSeverity;
  readAt: string | null;
  createdAt: string;
  metadataJson: unknown | null;
};

export type NotificationListResponse = {
  items: CmsNotification[];
  total: number;
};

export type ListNotificationsParams = {
  unread?: boolean;
  severity?: NotificationSeverity;
  type?: NotificationType;
  limit?: number;
  skip?: number;
};

function buildQuery(params?: ListNotificationsParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.unread === true) q.set('unread', 'true');
  if (params.unread === false) q.set('unread', 'false');
  if (params.severity) q.set('severity', params.severity);
  if (params.type) q.set('type', params.type);
  appendLimitParam(q, params.limit);
  if (params.skip != null) q.set('skip', String(params.skip));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function apiNotificationsList(
  token: string,
  tenantId: string,
  mallId: string | undefined,
  params?: ListNotificationsParams,
): Promise<NotificationListResponse> {
  return request<NotificationListResponse>(`/notifications${buildQuery(params)}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export function apiNotificationsUnreadCount(
  token: string,
  tenantId: string,
  mallId: string | undefined,
): Promise<{ count: number }> {
  return request<{ count: number }>('/notifications/unread-count', {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export function apiNotificationMarkRead(
  token: string,
  tenantId: string,
  mallId: string | undefined,
  id: string,
): Promise<CmsNotification> {
  return request<CmsNotification>(`/notifications/${id}/read`, {
    method: 'PATCH',
    token,
    tenantId,
    mallId,
  });
}

export function apiNotificationsMarkAllRead(
  token: string,
  tenantId: string,
  mallId: string | undefined,
): Promise<{ ok: true }> {
  return request<{ ok: true }>('/notifications/read-all', {
    method: 'PATCH',
    token,
    tenantId,
    mallId,
  });
}

export function apiNotificationDelete(
  token: string,
  tenantId: string,
  mallId: string | undefined,
  id: string,
): Promise<CmsNotification> {
  return request<CmsNotification>(`/notifications/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
    mallId,
  });
}

/** Basit varlık bağlantısı — ayrıntı sayfası yoksa liste rotasına düşer. */
export function notificationEntityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const t = entityType.toLowerCase();
  if (t === 'page') return `/pages/${entityId}`;
  if (t === 'slider') return '/sliders';
  if (t === 'event') return '/events';
  if (t === 'campaign') return '/campaigns';
  return null;
}
