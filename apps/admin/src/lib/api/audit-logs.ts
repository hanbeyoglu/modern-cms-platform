import { request } from './client';

export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SECURITY' | 'CRITICAL';

export type AuditActor = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type AuditTenant = {
  id: string;
  name: string;
  slug: string;
};

export type AuditMall = {
  id: string;
  name: string;
  slug: string;
};

export type AuditLog = {
  id: string;
  actorUserId: string | null;
  actor: AuditActor | null;
  tenantId: string | null;
  tenant: AuditTenant | null;
  mallId: string | null;
  mall: AuditMall | null;
  action: string;
  resource: string;
  resourceId: string | null;
  resourceName: string | null;
  severity: AuditSeverity;
  source: string | null;
  success: boolean;
  correlationId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditLogListResponse = {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type AuditLogFilters = {
  page?: number;
  limit?: number;
  tenantId?: string;
  mallId?: string;
  actorId?: string;
  resource?: string;
  action?: string;
  severity?: AuditSeverity;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  correlationId?: string;
};

function buildQs(filters?: AuditLogFilters): string {
  const qs = new URLSearchParams();
  if (!filters) return '';
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.limit) qs.set('limit', String(filters.limit));
  if (filters.tenantId) qs.set('tenantId', filters.tenantId);
  if (filters.mallId) qs.set('mallId', filters.mallId);
  if (filters.actorId) qs.set('actorId', filters.actorId);
  if (filters.resource) qs.set('resource', filters.resource);
  if (filters.action) qs.set('action', filters.action);
  if (filters.severity) qs.set('severity', filters.severity);
  if (filters.success !== undefined) qs.set('success', String(filters.success));
  if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) qs.set('dateTo', filters.dateTo);
  if (filters.search) qs.set('search', filters.search);
  if (filters.correlationId) qs.set('correlationId', filters.correlationId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function apiAuditLogsList(token: string, filters?: AuditLogFilters): Promise<AuditLogListResponse> {
  return request(`/audit-logs${buildQs(filters)}`, { token });
}

export function apiAuditLogGet(token: string, id: string): Promise<AuditLog> {
  return request(`/audit-logs/${id}`, { token });
}

export function apiAuditLogsTimeline(
  token: string,
  entityType: string,
  entityId: string,
): Promise<AuditLog[]> {
  return request(`/audit-logs/timeline/${entityType}/${entityId}`, { token });
}

export function apiAuditLogsRecentActivity(
  token: string,
  tenantId?: string,
  limit?: number,
): Promise<AuditLog[]> {
  const qs = new URLSearchParams();
  if (tenantId) qs.set('tenantId', tenantId);
  if (limit) qs.set('limit', String(limit));
  const s = qs.toString();
  return request(`/audit-logs/recent-activity${s ? `?${s}` : ''}`, { token });
}

export function apiAuditLogsSecurityEvents(
  token: string,
  tenantId?: string,
  limit?: number,
): Promise<AuditLog[]> {
  const qs = new URLSearchParams();
  if (tenantId) qs.set('tenantId', tenantId);
  if (limit) qs.set('limit', String(limit));
  const s = qs.toString();
  return request(`/audit-logs/security-events${s ? `?${s}` : ''}`, { token });
}

export function apiAuditLogsExportUrl(filters?: AuditLogFilters, format: 'csv' | 'json' = 'csv'): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
  const qs = new URLSearchParams();
  if (filters?.tenantId) qs.set('tenantId', filters.tenantId);
  if (filters?.severity) qs.set('severity', filters.severity);
  if (filters?.dateFrom) qs.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) qs.set('dateTo', filters.dateTo);
  qs.set('format', format);
  return `${base}/audit-logs/export?${qs.toString()}`;
}
