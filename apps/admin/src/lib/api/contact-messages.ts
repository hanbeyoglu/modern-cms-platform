import { request } from './client';
export type ContactStatus = 'NEW' | 'READ' | 'ARCHIVED';
export type ContactEmailNotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export type ContactMessageSummary = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  status: ContactStatus;
  createdAt: string;
};
export type ContactMessage = ContactMessageSummary & {
  tenantId: string;
  mallId: string;
  phone: string | null;
  message: string;
  kvkkConsent: boolean;
  kvkkConsentAt: string;
  updatedAt: string;
  readAt: string | null;
  archivedAt: string | null;
  emailNotificationStatus: ContactEmailNotificationStatus;
  emailNotificationSentAt: string | null;
  emailNotificationAttempts: number;
};
export type ContactList = {
  items: ContactMessageSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
export function contactMessagesList(
  token: string,
  tenantId: string,
  mallId: string,
  filters: { page: number; search?: string; status?: ContactStatus; from?: string; to?: string },
) {
  const params = new URLSearchParams({ page: String(filters.page), limit: '20' });
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
  return request<ContactList>(`/contact-messages?${params}`, { token, tenantId, mallId });
}
export function contactMessageDetail(token: string, tenantId: string, mallId: string, id: string) {
  return request<ContactMessage>(`/contact-messages/${encodeURIComponent(id)}`, {
    token,
    tenantId,
    mallId,
  });
}
export function contactMessageStatus(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
  status: ContactStatus,
) {
  return request<ContactMessage>(`/contact-messages/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    token,
    tenantId,
    mallId,
    body: JSON.stringify({ status }),
  });
}
export function contactMessagesCount(token: string, tenantId: string, mallId: string) {
  return request<{ count: number }>('/contact-messages/unread-count', { token, tenantId, mallId });
}
export function notifyContactMessageChange() {
  window.dispatchEvent(new Event('cms:contact-messages-changed'));
}
