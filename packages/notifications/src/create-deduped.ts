import type {
  Notification,
  NotificationSeverity,
  NotificationType,
  Prisma,
  PrismaClient,
} from '@prisma/client';

export const NOTIFICATION_DEDUP_WINDOW_MS = 30_000;

export type NotificationCreateInput = {
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

export type NotificationWriter = Pick<PrismaClient, 'notification'>;

export function buildDuplicateNotificationWhere(
  input: NotificationCreateInput,
  since: Date,
): Prisma.NotificationWhereInput {
  return {
    deletedAt: null,
    userId: input.userId ?? null,
    tenantId: input.tenantId ?? null,
    mallId: input.mallId ?? null,
    title: input.title,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    createdAt: { gte: since },
  };
}

/**
 * Creates an operational notification unless an identical one was created recently
 * for the same user/tenant/mall/title/entity within the dedup window.
 */
export async function createNotificationDeduped(
  prisma: NotificationWriter,
  input: NotificationCreateInput,
): Promise<Notification | null> {
  const since = new Date(Date.now() - NOTIFICATION_DEDUP_WINDOW_MS);
  const duplicate = await prisma.notification.findFirst({
    where: buildDuplicateNotificationWhere(input, since),
    select: { id: true },
  });
  if (duplicate) {
    return null;
  }

  return prisma.notification.create({
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
