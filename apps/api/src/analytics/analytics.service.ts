import { PublicContextService } from '../public/public-context.service';
import { CLICK_EVENTS, VIEW_EVENTS, EVENT_ENTITIES, analyticsPath } from './analytics-events';
import { createHash } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { AnalyticsEntityType, AnalyticsEventType, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { TrackAnalyticsDto } from './dto/track-analytics.dto';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto';

const TENANT_WIDE_MALL_ROLES = new Set(['TENANT_ADMIN', 'SUPER_ADMIN']);

function clientIp(req: Request): string | undefined {
  return req.ip || req.socket?.remoteAddress;
}

function hashIp(ip: string | undefined, salt: string): string | undefined {
  if (!ip || !ip.trim()) return undefined;
  return createHash('sha256').update(`${salt}|${ip.trim()}`).digest('hex');
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly config: ConfigService,
    private readonly context: PublicContextService,
  ) {}

  private ipSalt(): string {
    return (
      this.config.get<string>('ANALYTICS_IP_SALT') ??
      this.config.get<string>('JWT_SECRET') ??
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      'analytics-ip-salt-fallback'
    );
  }

  async track(req: Request, dto: TrackAnalyticsDto): Promise<{ ok: true; id: string }> {
    const tenantId = req.tenantId;
    if (!tenantId) throw new BadRequestException('API anahtarı bağlamı gerekli');
    const headerTenant = req.header('x-tenant-id')?.trim();
    if (headerTenant && headerTenant !== tenantId)
      throw new ForbiddenException('Tenant bağlamı geçersiz');
    const mallId = req.header('x-mall-id')?.trim();
    if (!mallId) throw new BadRequestException('x-mall-id başlığı gerekli');
    const context = await this.context.resolve(tenantId, mallId, dto.locale ?? undefined);
    const enabled = await this.prisma.tenantCapability.findFirst({
      where: { tenantId, enabled: true, capability: { code: 'analytics' } },
      select: { id: true },
    });
    if (!enabled)
      throw new ForbiddenException(
        'Bu müşteri için Raporlama (analytics) özelliği etkin değil. Süper yönetici müşteri özelliklerinden etkinleştirmelidir.',
      );
    const supportedEntities = EVENT_ENTITIES[dto.eventType];
    if (!supportedEntities?.includes(dto.entityType))
      throw new BadRequestException('Olay ve içerik türü uyumsuz');
    if (!['PAGE', 'CUSTOM'].includes(dto.entityType)) {
      if (!dto.entityId) throw new BadRequestException('İçerik kimliği gerekli');
      const names = await this.entityNames(dto.entityType, [dto.entityId], tenantId, mallId);
      if (!names.has(dto.entityId))
        throw new NotFoundException('İçerik bu AVM kapsamında bulunamadı');
    }
    const path = analyticsPath(dto.path);
    if (['PAGE', 'CUSTOM'].includes(dto.entityType) && !path)
      throw new BadRequestException('Sayfa yolu gerekli');
    const label =
      typeof dto.metadataJson?.label === 'string'
        ? dto.metadataJson.label.slice(0, 120)
        : undefined;
    const source =
      typeof dto.metadataJson?.source === 'string'
        ? dto.metadataJson.source.slice(0, 64)
        : undefined;
    const targetPath = analyticsPath(
      typeof dto.metadataJson?.targetPath === 'string' ? dto.metadataJson.targetPath : null,
    );
    try {
      const row = await this.prisma.analyticsEvent.create({
        data: {
          tenantId,
          mallId,
          clientEventId: dto.clientEventId,
          entityType: dto.entityType,
          entityId: ['PAGE', 'CUSTOM'].includes(dto.entityType) ? null : dto.entityId,
          eventType: dto.eventType,
          path,
          referrer: null,
          userAgent: null,
          // Daily tenant-scoped hash; never retain the IP itself or arbitrary client metadata.
          ipHash: hashIp(
            clientIp(req),
            `${this.ipSalt()}|${tenantId}|${new Date().toISOString().slice(0, 10)}`,
          ),
          deviceType: ['mobile', 'tablet', 'desktop'].includes(dto.deviceType ?? '')
            ? dto.deviceType
            : null,
          locale: context.locale?.code ?? null,
          metadataJson: {
            ...(label ? { label } : {}),
            ...(source ? { source } : {}),
            ...(targetPath ? { targetPath } : {}),
          },
        },
        select: { id: true },
      });
      return { ok: true, id: row.id };
    } catch (error) {
      if (
        dto.clientEventId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const row = await this.prisma.analyticsEvent.findUnique({
          where: {
            tenantId_mallId_clientEventId: { tenantId, mallId, clientEventId: dto.clientEventId },
          },
          select: { id: true },
        });
        if (row) return { ok: true, id: row.id };
      }
      throw error;
    }
  }

  private parseRange(q: AnalyticsQueryDto): { from: Date; to: Date } {
    const from = new Date(q.dateFrom);
    const to = new Date(q.dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Geçersiz tarih aralığı');
    }
    if (from > to) {
      throw new BadRequestException('dateFrom, dateTo’dan sonra olamaz');
    }
    if (to.getTime() - from.getTime() > 366 * 86400000)
      throw new BadRequestException('En fazla 366 günlük aralık seçin');
    return { from, to };
  }

  private async buildReportWhere(
    user: User,
    tenantId: string,
    mallIdHeader: string | undefined,
    q: AnalyticsQueryDto,
  ): Promise<Prisma.AnalyticsEventWhereInput | null> {
    const { from, to } = this.parseRange(q);
    const base: Prisma.AnalyticsEventWhereInput = {
      tenantId,
      createdAt: { gte: from, lte: to },
    };
    if (q.entityType) base.entityType = q.entityType;
    if (q.eventType) base.eventType = q.eventType;
    else if (q.metric === 'clicks') base.eventType = { in: CLICK_EVENTS };
    else if (q.metric === 'views') base.eventType = { in: VIEW_EVENTS };

    if (user.isSuperAdmin) {
      if (mallIdHeader) {
        await this.access.assertMallAccess(user, tenantId, mallIdHeader);
        base.mallId = mallIdHeader;
      }
      return base;
    }

    await this.access.assertTenantAccess(user, tenantId);

    if (mallIdHeader) {
      await this.access.assertMallAccess(user, tenantId, mallIdHeader);
      base.mallId = mallIdHeader;
      return base;
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, tenantId, deletedAt: null },
      include: { role: true, mallAccess: true },
    });
    if (!tenantUser) {
      throw new ForbiddenException('Bu tenant için erişim yok');
    }

    if (TENANT_WIDE_MALL_ROLES.has(tenantUser.role.code)) {
      return base;
    }

    const mallIds = tenantUser.mallAccess.map((a) => a.mallId);
    if (mallIds.length === 0) {
      return null;
    }
    base.mallId = { in: mallIds };
    return base;
  }

  async summary(
    user: User,
    tenantId: string,
    mallIdHeader: string | undefined,
    q: AnalyticsQueryDto,
  ): Promise<{
    totalEvents: number;
    pageViews: number;
    sliderClicks: number;
    eventViews: number;
    campaignClicks: number;
    storeViews: number;
    cinemaViews: number;
    totalClicks: number;
    storeClicks: number;
    eventClicks: number;
    cinemaClicks: number;
    movieClicks: number;
  }> {
    const where = await this.buildReportWhere(user, tenantId, mallIdHeader, q);
    if (!where) {
      return {
        totalEvents: 0,
        pageViews: 0,
        sliderClicks: 0,
        eventViews: 0,
        campaignClicks: 0,
        storeViews: 0,
        cinemaViews: 0,
        totalClicks: 0,
        storeClicks: 0,
        eventClicks: 0,
        cinemaClicks: 0,
        movieClicks: 0,
      };
    }

    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { _all: true },
    });

    const by = (t: AnalyticsEventType) => rows.find((r) => r.eventType === t)?._count._all ?? 0;

    const totalEvents = rows.reduce((s, r) => s + r._count._all, 0);

    return {
      totalEvents,
      totalClicks: CLICK_EVENTS.reduce((sum, type) => sum + by(type), 0),
      storeClicks: by(AnalyticsEventType.STORE_CLICK),
      eventClicks: by(AnalyticsEventType.EVENT_CLICK),
      cinemaClicks: by(AnalyticsEventType.CINEMA_CLICK),
      movieClicks: by(AnalyticsEventType.MOVIE_CLICK),
      pageViews: by(AnalyticsEventType.PAGE_VIEW),
      sliderClicks: by(AnalyticsEventType.SLIDER_CLICK),
      eventViews: by(AnalyticsEventType.EVENT_VIEW),
      campaignClicks: by(AnalyticsEventType.CAMPAIGN_CLICK),
      storeViews: by(AnalyticsEventType.STORE_VIEW),
      cinemaViews: by(AnalyticsEventType.CINEMA_VIEW),
    };
  }

  async topContent(
    user: User,
    tenantId: string,
    mallIdHeader: string | undefined,
    q: AnalyticsQueryDto,
  ): Promise<
    Array<{
      entityType: AnalyticsEntityType;
      entityId: string | null;
      eventType: AnalyticsEventType;
      count: number;
      name: string;
    }>
  > {
    const where = await this.buildReportWhere(user, tenantId, mallIdHeader, q);
    if (!where) return [];

    const take = q.limit ?? 50;

    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['entityType', 'entityId', 'eventType'],
      where,
      _count: { _all: true },
      orderBy: { _count: { eventType: 'desc' } },
      take,
    });

    const names = new Map<string, string>();
    for (const type of [...new Set(rows.map((row) => row.entityType))]) {
      const ids = rows
        .filter((row) => row.entityType === type && row.entityId)
        .map((row) => row.entityId!);
      const scopedMall =
        typeof where.mallId === 'string'
          ? where.mallId
          : where.mallId &&
              typeof where.mallId === 'object' &&
              'in' in where.mallId &&
              Array.isArray(where.mallId.in)
            ? where.mallId.in
            : undefined;
      const resolved = await this.entityNames(type, ids, tenantId, scopedMall);
      for (const [id, name] of resolved) names.set(`${type}:${id}`, name);
    }
    return rows.map((row) => ({
      entityType: row.entityType,
      entityId: row.entityId,
      eventType: row.eventType,
      count: row._count._all,
      name: row.entityId
        ? (names.get(`${row.entityType}:${row.entityId}`) ?? 'Silinmiş veya erişilemeyen içerik')
        : 'Genel sayfa / bağlantı',
    }));
  }

  /** Resolve only names visible in the selected tenant/mall; never accept client labels as entity names. */
  private async entityNames(
    type: AnalyticsEntityType,
    ids: string[],
    tenantId: string,
    mallId?: string | string[],
  ): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const base = { id: { in: ids }, tenantId, deletedAt: null };
    const mallScope = mallId
      ? { mallId: typeof mallId === 'string' ? mallId : { in: mallId } }
      : {};
    const shared = mallId ? { OR: [mallScope, { mallId: null }] } : {};
    switch (type) {
      case 'STORE':
        return new Map(
          (
            await this.prisma.mallStore.findMany({
              where: { ...base, ...mallScope },
              select: { id: true, detailTitle: true, globalStore: { select: { name: true } } },
            })
          ).map((row) => [row.id, row.detailTitle || row.globalStore.name]),
        );
      case 'EVENT':
        return new Map(
          (
            await this.prisma.event.findMany({
              where: { ...base, ...shared },
              select: { id: true, title: true },
            })
          ).map((row) => [row.id, row.title]),
        );
      case 'CAMPAIGN':
        return new Map(
          (
            await this.prisma.campaign.findMany({
              where: { ...base, ...shared },
              select: { id: true, title: true },
            })
          ).map((row) => [row.id, row.title]),
        );
      case 'CINEMA':
        return new Map(
          (
            await this.prisma.cinema.findMany({
              where: { ...base, ...mallScope },
              select: { id: true, name: true },
            })
          ).map((row) => [row.id, row.name]),
        );
      case 'MOVIE':
        return new Map(
          (
            await this.prisma.movie.findMany({ where: base, select: { id: true, title: true } })
          ).map((row) => [row.id, row.title]),
        );
      case 'SLIDER':
        return new Map(
          (
            await this.prisma.slider.findMany({
              where: { ...base, ...mallScope },
              select: { id: true, title: true },
            })
          ).map((row) => [row.id, row.title]),
        );
      case 'MOVIE_SESSION':
        return new Map(
          (
            await this.prisma.movieSession.findMany({
              where: { ...base, ...mallScope },
              select: { id: true, movie: { select: { title: true } }, startsAt: true },
            })
          ).map((row) => [row.id, `${row.movie.title} · ${row.startsAt?.toISOString() ?? ''}`]),
        );
      default:
        return new Map();
    }
  }

  async topPaths(user: User, tenantId: string, mallId: string | undefined, q: AnalyticsQueryDto) {
    const where = await this.buildReportWhere(user, tenantId, mallId, q);
    if (!where) return [];
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['path', 'eventType'],
      where: { ...where, path: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { eventType: 'desc' } },
      take: q.limit ?? 50,
    });
    return rows.map((row) => ({
      path: row.path,
      eventType: row.eventType,
      count: row._count._all,
    }));
  }

  async timeseries(
    user: User,
    tenantId: string,
    mallIdHeader: string | undefined,
    q: AnalyticsQueryDto,
  ): Promise<{ date: string; byEventType: Record<string, number> }[]> {
    const where = await this.buildReportWhere(user, tenantId, mallIdHeader, q);
    if (!where) return [];

    const { from, to } = this.parseRange(q);

    const fragments: Prisma.Sql[] = [
      Prisma.sql`"tenantId" = ${tenantId}`,
      Prisma.sql`"createdAt" >= ${from}`,
      Prisma.sql`"createdAt" <= ${to}`,
    ];

    if (where.mallId !== undefined) {
      if (typeof where.mallId === 'string') {
        fragments.push(Prisma.sql`"mallId" = ${where.mallId}`);
      } else if (
        where.mallId &&
        typeof where.mallId === 'object' &&
        'in' in where.mallId &&
        Array.isArray(where.mallId.in) &&
        where.mallId.in.length > 0
      ) {
        fragments.push(Prisma.sql`"mallId" IN (${Prisma.join(where.mallId.in)})`);
      }
    }

    if (q.entityType) {
      fragments.push(Prisma.sql`"entityType" = ${q.entityType}::"AnalyticsEntityType"`);
    }
    if (q.eventType) {
      fragments.push(Prisma.sql`"eventType" = ${q.eventType}::"AnalyticsEventType"`);
    }

    if (!q.eventType && q.metric && q.metric !== 'all') {
      const types = q.metric === 'clicks' ? CLICK_EVENTS : VIEW_EVENTS;
      fragments.push(Prisma.sql`"eventType"::text IN (${Prisma.join(types)})`);
    }

    const rows = await this.prisma.$queryRaw<{ day: Date; eventType: string; c: bigint }[]>(
      Prisma.sql`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'UTC') AS day,
             "eventType"::text AS "eventType",
             COUNT(*)::bigint AS c
      FROM "AnalyticsEvent"
      WHERE ${Prisma.join(fragments, ' AND ')}
      GROUP BY 1, "eventType"
      ORDER BY 1 ASC
    `,
    );

    const map = new Map<string, Record<string, number>>();
    for (
      let day = new Date(from.toISOString().slice(0, 10));
      day <= to;
      day = new Date(day.getTime() + 86400000)
    )
      map.set(day.toISOString().slice(0, 10), {});
    for (const r of rows) {
      const key = r.day.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, {});
      const bucket = map.get(key)!;
      bucket[r.eventType] = Number(r.c);
    }

    return [...map.entries()].map(([date, byEventType]) => ({ date, byEventType }));
  }
}
