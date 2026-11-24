import { request } from './client';

export type DemoPreviewResponse = {
  tenant: { id: string; name: string; slug: string };
  mall: { id: string; name: string; slug: string; displayName: string | null };
  targetMallName: string;
  shiftDates: boolean;
  dateShiftDays: number;
  sourceSystem: string;
  counts: {
    stores: number;
    campaigns: number;
    events: number;
    movies: number;
    sliders: number;
    uniqueMediaUrls: number;
  };
  expiredAsDraft: Array<{ entityType: string; sourceKey: string; endDate: string }>;
  unmatchedStoreRefs: Array<{ entityType: string; sourceKey: string; storeRef: string }>;
  unsupportedFields: Array<{ entityType: string; sourceKey: string; fields: string[] }>;
  textReplacements: Array<{
    entityType: string;
    sourceKey: string;
    field: string;
    before: string;
    after: string;
  }>;
  publicVisibility: {
    campaigns: number;
    events: number;
    movies: number;
    sliders: number;
  };
  media: {
    uniqueUrls: number;
    wouldUpload: number;
    reused: number;
    uploaded: number;
    failed: number;
  };
  rowSummary: Record<string, number>;
  existingDemoMappings: number;
  errors: string[];
  note: string;
};

export type DemoBatchStartResponse = {
  batchId: string;
  status: string;
  shiftDates?: boolean;
  tenant: { id: string; name: string; slug: string };
  mall: { id: string; name: string; slug: string; displayName: string | null };
};

export type DemoBatchStatus = {
  id: string;
  action: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  reportJson?: unknown;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

export type DemoRemoveResponse = {
  batchId: string;
  tenant: { id: string; name: string; slug: string };
  mall: { id: string; name: string; slug: string; displayName: string | null };
  deleted: Record<string, number>;
  mediaDeleted: number;
  errors: string[];
};

export type MallResetPreview = {
  tenant: { id: string; name: string; slug: string };
  mall: { id: string; name: string; slug: string; displayName: string | null };
  confirmHint: string;
  counts: Record<string, number>;
  preserved: string[];
};

export type MallResetResult = {
  batchId: string;
  tenant: { id: string; name: string; slug: string };
  mall: { id: string; name: string; slug: string; displayName: string | null };
  deleted: Record<string, number>;
  preserved: string[];
};

export type DemoImportOptions = {
  shiftDates?: boolean;
};

export function apiDemoContentPreview(
  token: string,
  mallId: string,
  tenantId?: string,
  options: DemoImportOptions = {},
) {
  return request<DemoPreviewResponse>(`/locations/${mallId}/demo-content/preview`, {
    method: 'POST',
    token,
    tenantId,
    mallId,
    body: JSON.stringify({ shiftDates: options.shiftDates === true }),
  });
}

export function apiDemoContentApply(
  token: string,
  mallId: string,
  tenantId?: string,
  options: DemoImportOptions = {},
) {
  return request<DemoBatchStartResponse>(`/locations/${mallId}/demo-content/apply`, {
    method: 'POST',
    token,
    tenantId,
    mallId,
    body: JSON.stringify({ shiftDates: options.shiftDates === true }),
  });
}

export function apiDemoContentBatch(
  token: string,
  mallId: string,
  batchId: string,
  tenantId?: string,
) {
  return request<DemoBatchStatus>(`/locations/${mallId}/demo-content/batches/${batchId}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export function apiDemoContentRemove(token: string, mallId: string, tenantId?: string) {
  return request<DemoRemoveResponse>(`/locations/${mallId}/demo-content/remove`, {
    method: 'POST',
    token,
    tenantId,
    mallId,
  });
}

export function apiMallContentResetPreview(token: string, mallId: string, tenantId?: string) {
  return request<MallResetPreview>(`/locations/${mallId}/demo-content/reset/preview`, {
    method: 'POST',
    token,
    tenantId,
    mallId,
  });
}

export function apiMallContentReset(
  token: string,
  mallId: string,
  body: { confirmName: string; confirmAgain: boolean },
  tenantId?: string,
) {
  return request<MallResetResult>(`/locations/${mallId}/demo-content/reset`, {
    method: 'POST',
    token,
    tenantId,
    mallId,
    body: JSON.stringify(body),
  });
}
