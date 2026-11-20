import type { Prisma } from '@prisma/client';

/** Scheduler/worker technical failures — must never appear in the user inbox. */
export const SCHEDULER_FAILURE_TITLE = 'Zamanlama işi başarısız';

export function isTechnicalNotificationWhere(): Prisma.NotificationWhereInput {
  return {
    OR: [
      {
        type: 'SYSTEM',
        severity: 'ERROR',
        title: SCHEDULER_FAILURE_TITLE,
      },
      {
        metadataJson: { path: ['workerFailure'], equals: true },
      },
    ],
  };
}
