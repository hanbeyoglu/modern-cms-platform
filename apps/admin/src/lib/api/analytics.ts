import { appendLimitParam } from './constants';
import { request } from './client';

export type AnalyticsSummary = {
  totalEvents: number;
  pageViews: number;
  sliderClicks: number;
  eventViews: number;
  campaignClicks: number;
  storeViews: number;
  cinemaViews: number;
};

export type AnalyticsTopRow = {
  entityType: string;
  entityId: string | null;
  eventType: string;
  count: number;
};

export type AnalyticsTimeseriesRow = {
  date: string;
  byEventType: Record<string, number>;
};

export type AnalyticsQueryParams = {
  dateFrom: string;
  dateTo: string;
  entityType?: string;
  eventType?: string;
  limit?: number;
};

function toQuery(params: AnalyticsQueryParams): string {
  const sp = new URLSearchParams();
  sp.set('dateFrom', params.dateFrom);
  sp.set('dateTo', params.dateTo);
  if (params.entityType) sp.set('entityType', params.entityType);
  if (params.eventType) sp.set('eventType', params.eventType);
  appendLimitParam(sp, params.limit);
  return sp.toString();
}

export async function apiAnalyticsSummary(
  token: string,
  tenantId: string,
  mallId: string | undefined,
  params: AnalyticsQueryParams,
): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>(`/analytics/summary?${toQuery(params)}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export async function apiAnalyticsTopContent(
  token: string,
  tenantId: string,
  mallId: string | undefined,
  params: AnalyticsQueryParams,
): Promise<AnalyticsTopRow[]> {
  return request<AnalyticsTopRow[]>(`/analytics/top-content?${toQuery(params)}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}

export async function apiAnalyticsTimeseries(
  token: string,
  tenantId: string,
  mallId: string | undefined,
  params: AnalyticsQueryParams,
): Promise<AnalyticsTimeseriesRow[]> {
  return request<AnalyticsTimeseriesRow[]>(`/analytics/timeseries?${toQuery(params)}`, {
    method: 'GET',
    token,
    tenantId,
    mallId,
  });
}
