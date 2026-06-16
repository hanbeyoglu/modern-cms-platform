import { request } from './client';

export type DashboardTimelineType =
  | 'campaign'
  | 'event'
  | 'slider'
  | 'popup'
  | 'page'
  | 'media'
  | 'service'
  | 'store';

export type DashboardTimelineItem = {
  id: string;
  type: DashboardTimelineType;
  title: string;
  status: string;
  timestamp: string;
  href: string;
};

export type UpcomingContentItem = {
  id: string;
  type: Exclude<DashboardTimelineType, 'media' | 'service' | 'store'>;
  title: string;
  status: string;
  scheduledAt: string;
  href: string;
};

export type DashboardSummary = {
  totalStores: number;
  activeCampaigns: number;
  upcomingEvents: number;
  activeSliders: number;
  activePopups: number;
  mediaCount: number;
  servicesCount: number;
  recentActivity: DashboardTimelineItem[];
  upcomingContent: UpcomingContentItem[];
};

export async function apiDashboardSummary(
  token: string,
  tenantId: string,
  mallId?: string,
): Promise<DashboardSummary> {
  return request<DashboardSummary>('/dashboard/summary', {
    method: 'GET',
    token,
    tenantId,
    ...(mallId ? { mallId } : {}),
  });
}
