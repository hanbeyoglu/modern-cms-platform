import { request } from './client';

export type MediaGuideline = {
  id: string | null;
  usageKey: string;
  label: string;
  recommendedWidth: number;
  recommendedHeight: number;
  acceptedMimeTypes: string[];
  helperText: string | null;
  aspectRatioLocked: boolean;
  active: boolean;
  aspectRatio: string;
  source: 'tenant' | 'default';
};

export type UpdateMediaGuidelinePayload = {
  recommendedWidth?: number;
  recommendedHeight?: number;
  acceptedMimeTypes?: string[];
  helperText?: string | null;
  aspectRatioLocked?: boolean;
  active?: boolean;
};

export async function apiMediaGuidelinesList(
  token: string,
  tenantId: string,
): Promise<MediaGuideline[]> {
  return request<MediaGuideline[]>('/media/guidelines', { method: 'GET', token, tenantId });
}

export async function apiMediaGuidelineUpdate(
  token: string,
  tenantId: string,
  usageKey: string,
  body: UpdateMediaGuidelinePayload,
): Promise<MediaGuideline> {
  return request<MediaGuideline>(`/media/guidelines/${encodeURIComponent(usageKey)}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}
