import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma, User } from '@prisma/client';
import { NotificationSeverity, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

export type CreateNotificationInput = {
  tenantId?: string | null;
  mallId?: string | null;
  userId?: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId ?? null,
        mallId: input.mallId ?? null,
        userId: input.userId ?? null,
        type: input.type,
        severity: input.severity,
        title: input.title,
        message: input.message,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadataJson: input.metadataJson ?? undefined,
      },
    });
  }

  private async visibilityOr(
    user: User,
    tenantId: string,
    requestMallId: string | undefined,
  ): Promise<Prisma.NotificationWhereInput[]> {
    const malls = await this.access.listMallsForUser(user, tenantId);
    const mallIds = malls.map((m) => m.id);

    const or: Prisma.NotificationWhereInput[] = [
      {
        userId: user.id,
        OR: [{ tenantId: null }, { tenantId }],
      },
      {
        tenantId: null,
        mallId: null,
        userId: null,
        NOT: {
          metadataJson: { path: ['workerFailure'], equals: true },
        },
      },
      { tenantId, mallId: null, userId: null },
    ];

    if (requestMallId) {
      or.push({ tenantId, mallId: requestMallId, userId: null });
    } else {
      or.push({
        tenantId,
        userId: null,
        mallId: { in: mallIds },
      });
    }

    if (user.isSuperAdmin) {
      or.push({
        tenantId: null,
        mallId: null,
        userId: null,
        metadataJson: { path: ['workerFailure'], equals: true },
      });
    }

    return or;
  }

  private async assertVisible(
    user: User,
    tenantId: string,
    requestMallId: string | undefined,
    id: string,
  ): Promise<Notification> {
    const visibilityOr = await this.visibilityOr(user, tenantId, requestMallId);
    const row = await this.prisma.notification.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: visibilityOr,
      },
    });
    if (!row) {
      throw new NotFoundException('Bildirim bulunamadı');
    }
    return row;
  }

  async list(
    user: User,
    tenantId: string,
    requestMallId: string | undefined,
    query: ListNotificationsDto,
  ): Promise<{ items: Notification[]; total: number }> {
    const visibilityOr = await this.visibilityOr(user, tenantId, requestMallId);
    const take = query.limit ?? 30;
    const skip = query.skip ?? 0;

    const andFilters: Prisma.NotificationWhereInput[] = [{ OR: visibilityOr }, { deletedAt: null }];

    if (query.unread === true) {
      andFilters.push({ readAt: null });
    } else if (query.unread === false) {
      andFilters.push({ readAt: { not: null } });
    }
    if (query.severity) {
      andFilters.push({ severity: query.severity });
    }
    if (query.type) {
      andFilters.push({ type: query.type });
    }

    const where: Prisma.NotificationWhereInput = { AND: andFilters };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total };
  }

  async unreadCount(
    user: User,
    tenantId: string,
    requestMallId: string | undefined,
  ): Promise<{ count: number }> {
    const visibilityOr = await this.visibilityOr(user, tenantId, requestMallId);
    const count = await this.prisma.notification.count({
      where: {
        AND: [{ OR: visibilityOr }, { deletedAt: null }, { readAt: null }],
      },
    });
    return { count };
  }

  async markRead(user: User, tenantId: string, requestMallId: string | undefined, id: string) {
    await this.assertVisible(user, tenantId, requestMallId, id);
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(user: User, tenantId: string, requestMallId: string | undefined) {
    const visibilityOr = await this.visibilityOr(user, tenantId, requestMallId);
    await this.prisma.notification.updateMany({
      where: {
        AND: [{ OR: visibilityOr }, { deletedAt: null }, { readAt: null }],
      },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  }

  async softDelete(user: User, tenantId: string, requestMallId: string | undefined, id: string) {
    await this.assertVisible(user, tenantId, requestMallId, id);
    return this.prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
