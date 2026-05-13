import { createHash } from 'crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import {
  AnalyticsEntityType,
  AnalyticsEventType,
  Prisma,
} from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { TrackAnalyticsDto } from './dto/track-analytics.dto';
import type { AnalyticsQueryDto } from './dto/analytics-query.dto';

const TENANT_WIDE_MALL_ROLES = new Set(['TENANT_ADMIN', 'SUPER_ADMIN']);

function clientIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]?.trim();
  }
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) return socketIp;
  return req.ip;
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
  ) {}

  private ipSalt(): string {
    return (
      this.config.get<string>('ANALYTICS_IP_SALT') ??
      this.config.get<string>('JWT_SECRET') ??
      'analytics-ip-salt-fallback'
    );
  }

  async track(req: Request, dto: TrackAnalyticsDto): Promise<{ ok: true; id: string }> {
    const tenantId = req.header('x-tenant-id')?.trim();
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id başlığı gerekli');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant bulunamadı');
    }

    const mallHeader = req.header('x-mall-id')?.trim();
    let mallId: string | null = null;
    if (mallHeader) {
      const mall = await this.prisma.mall.findFirst({
        where: { id: mallHeader, tenantId, deletedAt: null },
      });
      if (!mall) {
        throw new NotFoundException('Mall bulunamadı veya bu tenant’a ait değil');
      }
      mallId = mall.id;
    }

    const ua =
      (typeof req.headers['user-agent'] === 'string' && req.headers['user-agent']) || null;
    const ipHash = hashIp(clientIp(req), this.ipSalt());

    const row = await this.prisma.analyticsEvent.create({
      data: {
        tenantId,
        mallId,
        entityType: dto.entityType,
        entityId: dto.entityId ?? null,
        eventType: dto.eventType,
        path: dto.path ?? null,
        referrer: dto.referrer ?? null,
        userAgent: ua,
        deviceType: dto.deviceType ?? null,
        ipHash,
        metadataJson:
          dto.metadataJson === undefined || dto.metadataJson === null
            ? Prisma.JsonNull
            : (dto.metadataJson as Prisma.InputJsonValue),
      },
    });

    return { ok: true, id: row.id };
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
      };
    }

    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { _all: true },
    });

    const by = (t: AnalyticsEventType) =>
      rows.find((r) => r.eventType === t)?._count._all ?? 0;

    const totalEvents = rows.reduce((s, r) => s + r._count._all, 0);

    return {
      totalEvents,
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
    }>
  > {
    const where = await this.buildReportWhere(user, tenantId, mallIdHeader, q);
    if (!where) return [];

    const take = q.limit ?? 50;

    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['entityType', 'entityId', 'eventType'],
      where,
      _count: { _all: true },
    });

    rows.sort((a, b) => b._count._all - a._count._all);
    const sliced = rows.slice(0, take);

    return sliced.map((r) => ({
      entityType: r.entityType,
      entityId: r.entityId,
      eventType: r.eventType,
      count: r._count._all,
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
    for (const r of rows) {
      const key = r.day.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, {});
      const bucket = map.get(key)!;
      bucket[r.eventType] = Number(r.c);
    }

    return [...map.entries()].map(([date, byEventType]) => ({ date, byEventType }));
  }
}
