import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DashboardTimelineItem = {
  id: string;
  type: 'campaign' | 'event' | 'slider' | 'popup' | 'page' | 'media' | 'service' | 'store';
  title: string;
  status: string;
  timestamp: Date;
  href: string;
};

type UpcomingContentItem = {
  id: string;
  type: 'campaign' | 'event' | 'slider' | 'popup' | 'page';
  title: string;
  status: string;
  scheduledAt: Date;
  href: string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string, mallId?: string) {
    const now = new Date();
    const mallFilter = mallId !== undefined ? { mallId } : {};
    const tenantMallFilter = { tenantId, ...mallFilter, deletedAt: null };
    const activeContentWindow = {
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    };

    const [
      totalStores,
      activeCampaigns,
      upcomingEvents,
      activeSliders,
      activePopups,
      mediaCount,
      servicesCount,
      recentActivity,
      upcomingContent,
    ] = await Promise.all([
      this.prisma.mallStore.count({
        where: { tenantId, ...mallFilter, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.campaign.count({
        where: { ...tenantMallFilter, status: 'PUBLISHED', ...activeContentWindow },
      }),
      this.prisma.event.count({
        where: { ...tenantMallFilter, status: { in: ['PUBLISHED', 'SCHEDULED'] }, startAt: { gt: now } },
      }),
      this.prisma.slider.count({
        where: { ...tenantMallFilter, status: 'PUBLISHED', ...activeContentWindow },
      }),
      this.prisma.popup.count({
        where: { ...tenantMallFilter, status: 'PUBLISHED', ...activeContentWindow },
      }),
      this.prisma.mediaAsset.count({
        where: { tenantId, ...mallFilter, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.service.count({
        where: { tenantId, ...mallFilter, status: 'ACTIVE', deletedAt: null },
      }),
      this.recentActivity(tenantId, mallId),
      this.upcomingContent(tenantId, mallId, now),
    ]);

    return {
      totalStores,
      activeCampaigns,
      upcomingEvents,
      activeSliders,
      activePopups,
      mediaCount,
      servicesCount,
      recentActivity,
      upcomingContent,
    };
  }

  private async recentActivity(tenantId: string, mallId?: string): Promise<DashboardTimelineItem[]> {
    const mallFilter = mallId !== undefined ? { mallId } : {};
    const tenantMallFilter = { tenantId, ...mallFilter, deletedAt: null };
    const [campaigns, events, sliders, popups, pages, media, services, stores] = await Promise.all([
      this.prisma.campaign.findMany({
        where: tenantMallFilter,
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      this.prisma.event.findMany({
        where: tenantMallFilter,
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      this.prisma.slider.findMany({
        where: tenantMallFilter,
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      this.prisma.popup.findMany({
        where: tenantMallFilter,
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      this.prisma.page.findMany({
        where: tenantMallFilter,
        select: { id: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      this.prisma.mediaAsset.findMany({
        where: { tenantId, ...mallFilter, deletedAt: null },
        select: { id: true, originalName: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      this.prisma.service.findMany({
        where: { tenantId, ...mallFilter, deletedAt: null },
        select: { id: true, name: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
      this.prisma.mallStore.findMany({
        where: { tenantId, ...mallFilter, deletedAt: null },
        select: {
          id: true,
          localName: true,
          status: true,
          updatedAt: true,
          globalStore: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
    ]);

    return [
      ...campaigns.map((item) => this.activityItem('campaign', item.id, item.title, item.status, item.updatedAt, '/campaigns')),
      ...events.map((item) => this.activityItem('event', item.id, item.title, item.status, item.updatedAt, '/events')),
      ...sliders.map((item) => this.activityItem('slider', item.id, item.title, item.status, item.updatedAt, '/sliders')),
      ...popups.map((item) => this.activityItem('popup', item.id, item.title, item.status, item.updatedAt, '/popups')),
      ...pages.map((item) => this.activityItem('page', item.id, item.title, item.status, item.updatedAt, '/pages')),
      ...media.map((item) => this.activityItem('media', item.id, item.originalName, item.status, item.updatedAt, '/media')),
      ...services.map((item) => this.activityItem('service', item.id, item.name, item.status, item.updatedAt, '/services')),
      ...stores.map((item) =>
        this.activityItem('store', item.id, item.localName ?? item.globalStore.name, item.status, item.updatedAt, '/mall-stores'),
      ),
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 8);
  }

  private async upcomingContent(
    tenantId: string,
    mallId: string | undefined,
    now: Date,
  ): Promise<UpcomingContentItem[]> {
    const mallFilter = mallId !== undefined ? { mallId } : {};
    const tenantMallFilter = { tenantId, ...mallFilter, deletedAt: null };
    const [campaigns, events, sliders, popups, pages] = await Promise.all([
      this.prisma.campaign.findMany({
        where: {
          ...tenantMallFilter,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          startAt: { gt: now },
        },
        select: { id: true, title: true, status: true, startAt: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
      this.prisma.event.findMany({
        where: {
          ...tenantMallFilter,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          startAt: { gt: now },
        },
        select: { id: true, title: true, status: true, startAt: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
      this.prisma.slider.findMany({
        where: {
          ...tenantMallFilter,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          startAt: { gt: now },
        },
        select: { id: true, title: true, status: true, startAt: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
      this.prisma.popup.findMany({
        where: {
          ...tenantMallFilter,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          startAt: { gt: now },
        },
        select: { id: true, title: true, status: true, startAt: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
      this.prisma.page.findMany({
        where: {
          ...tenantMallFilter,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          publishAt: { gt: now },
        },
        select: { id: true, title: true, status: true, publishAt: true },
        orderBy: { publishAt: 'asc' },
        take: 5,
      }),
    ]);

    return [
      ...campaigns.map((item) => this.upcomingItem('campaign', item.id, item.title, item.status, item.startAt, '/campaigns')),
      ...events.map((item) => this.upcomingItem('event', item.id, item.title, item.status, item.startAt, '/events')),
      ...sliders.map((item) => this.upcomingItem('slider', item.id, item.title, item.status, item.startAt, '/sliders')),
      ...popups.map((item) => this.upcomingItem('popup', item.id, item.title, item.status, item.startAt, '/popups')),
      ...pages.map((item) => this.upcomingItem('page', item.id, item.title, item.status, item.publishAt, '/pages')),
    ]
      .filter((item): item is UpcomingContentItem => item !== null)
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .slice(0, 8);
  }

  private activityItem(
    type: DashboardTimelineItem['type'],
    id: string,
    title: string,
    status: string,
    timestamp: Date,
    href: string,
  ): DashboardTimelineItem {
    return { id, type, title, status, timestamp, href };
  }

  private upcomingItem(
    type: UpcomingContentItem['type'],
    id: string,
    title: string,
    status: string,
    scheduledAt: Date | null,
    href: string,
  ): UpcomingContentItem | null {
    if (!scheduledAt) return null;
    return { id, type, title, status, scheduledAt, href };
  }
}
