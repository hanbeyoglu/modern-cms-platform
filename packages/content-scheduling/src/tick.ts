/** Minimal Prisma delegate shape used by the scheduling tick (structural, not PrismaClient-coupled). */
type ScheduledRow = {
  id: string;
  tenantId: string;
  mallId: string | null;
};

type UpdateManyResult = { count: number };

type SchedulingDelegate = {
  findMany: (args: {
    where: Record<string, unknown>;
    select: { id: true; tenantId: true; mallId: true };
    take: number;
    orderBy: Record<string, 'asc' | 'desc'>;
  }) => Promise<ScheduledRow[]>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<UpdateManyResult>;
};

export type SchedulingDb = {
  page: SchedulingDelegate;
  slider: SchedulingDelegate;
  event: SchedulingDelegate;
  campaign: SchedulingDelegate;
  popup: SchedulingDelegate;
};

/** Slider / Event / Campaign / Popup use `startAt` / `endAt`. Page uses `publishAt` / `unpublishAt`. */
export type ScheduledEntityKind = 'slider' | 'event' | 'campaign' | 'page' | 'popup';

export type ScheduleTransition = {
  kind: ScheduledEntityKind;
  id: string;
  tenantId: string;
  mallId: string | null;
  action: 'publish' | 'archive';
  previousStatus: string;
  nextStatus: string;
};

export type RunContentSchedulingTickOptions = {
  now?: Date;
  /** Max rows considered per entity kind per tick (bounded scan). */
  batchSize?: number;
};

export type RunContentSchedulingTickResult = {
  transitions: ScheduleTransition[];
};

const PUBLISHED = 'PUBLISHED' as const;
const SCHEDULED = 'SCHEDULED' as const;
const ARCHIVED = 'ARCHIVED' as const;

/**
 * Idempotent scheduling tick: `updateMany` with status + time guards so concurrent workers
 * cannot double-publish. Safe to run every few seconds.
 */
export async function runContentSchedulingTick(
  prisma: SchedulingDb,
  opts: RunContentSchedulingTickOptions = {},
): Promise<RunContentSchedulingTickResult> {
  const now = opts.now ?? new Date();
  const batchSize = opts.batchSize ?? 40;
  const transitions: ScheduleTransition[] = [];

  // ── Publish: SCHEDULED → PUBLISHED ───────────────────────────────────────

  const sliderPub = await prisma.slider.findMany({
    where: {
      deletedAt: null,
      status: SCHEDULED,
      startAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { startAt: 'asc' },
  });
  for (const row of sliderPub) {
    const r = await prisma.slider.updateMany({
      where: {
        id: row.id,
        status: SCHEDULED,
        deletedAt: null,
        startAt: { not: null, lte: now },
      },
      data: { status: PUBLISHED },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'slider',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'publish',
        previousStatus: SCHEDULED,
        nextStatus: PUBLISHED,
      });
    }
  }

  const eventPub = await prisma.event.findMany({
    where: {
      deletedAt: null,
      status: SCHEDULED,
      startAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { startAt: 'asc' },
  });
  for (const row of eventPub) {
    const r = await prisma.event.updateMany({
      where: {
        id: row.id,
        status: SCHEDULED,
        deletedAt: null,
        startAt: { not: null, lte: now },
      },
      data: { status: PUBLISHED, publishedAt: now },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'event',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'publish',
        previousStatus: SCHEDULED,
        nextStatus: PUBLISHED,
      });
    }
  }

  const campaignPub = await prisma.campaign.findMany({
    where: {
      deletedAt: null,
      status: SCHEDULED,
      startAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { startAt: 'asc' },
  });
  for (const row of campaignPub) {
    const r = await prisma.campaign.updateMany({
      where: {
        id: row.id,
        status: SCHEDULED,
        deletedAt: null,
        startAt: { not: null, lte: now },
      },
      data: { status: PUBLISHED, publishedAt: now },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'campaign',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'publish',
        previousStatus: SCHEDULED,
        nextStatus: PUBLISHED,
      });
    }
  }

  const pagePub = await prisma.page.findMany({
    where: {
      deletedAt: null,
      status: SCHEDULED,
      publishAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { publishAt: 'asc' },
  });
  for (const row of pagePub) {
    const r = await prisma.page.updateMany({
      where: {
        id: row.id,
        status: SCHEDULED,
        deletedAt: null,
        publishAt: { not: null, lte: now },
      },
      data: { status: PUBLISHED, publishedAt: now },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'page',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'publish',
        previousStatus: SCHEDULED,
        nextStatus: PUBLISHED,
      });
    }
  }

  // ── Archive: PUBLISHED → ARCHIVED ─────────────────────────────────────────

  const sliderArch = await prisma.slider.findMany({
    where: {
      deletedAt: null,
      status: PUBLISHED,
      endAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { endAt: 'asc' },
  });
  for (const row of sliderArch) {
    const r = await prisma.slider.updateMany({
      where: {
        id: row.id,
        status: PUBLISHED,
        deletedAt: null,
        endAt: { not: null, lte: now },
      },
      data: { status: ARCHIVED },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'slider',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'archive',
        previousStatus: PUBLISHED,
        nextStatus: ARCHIVED,
      });
    }
  }

  const eventArch = await prisma.event.findMany({
    where: {
      deletedAt: null,
      status: PUBLISHED,
      endAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { endAt: 'asc' },
  });
  for (const row of eventArch) {
    const r = await prisma.event.updateMany({
      where: {
        id: row.id,
        status: PUBLISHED,
        deletedAt: null,
        endAt: { not: null, lte: now },
      },
      data: { status: ARCHIVED },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'event',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'archive',
        previousStatus: PUBLISHED,
        nextStatus: ARCHIVED,
      });
    }
  }

  const campaignArch = await prisma.campaign.findMany({
    where: {
      deletedAt: null,
      status: PUBLISHED,
      endAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { endAt: 'asc' },
  });
  for (const row of campaignArch) {
    const r = await prisma.campaign.updateMany({
      where: {
        id: row.id,
        status: PUBLISHED,
        deletedAt: null,
        endAt: { not: null, lte: now },
      },
      data: { status: ARCHIVED },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'campaign',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'archive',
        previousStatus: PUBLISHED,
        nextStatus: ARCHIVED,
      });
    }
  }

  const pageArch = await prisma.page.findMany({
    where: {
      deletedAt: null,
      status: PUBLISHED,
      unpublishAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { unpublishAt: 'asc' },
  });
  for (const row of pageArch) {
    const r = await prisma.page.updateMany({
      where: {
        id: row.id,
        status: PUBLISHED,
        deletedAt: null,
        unpublishAt: { not: null, lte: now },
      },
      data: { status: ARCHIVED },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'page',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'archive',
        previousStatus: PUBLISHED,
        nextStatus: ARCHIVED,
      });
    }
  }

  // ── Popup: SCHEDULED → PUBLISHED ─────────────────────────────────────────

  const popupPub = await prisma.popup.findMany({
    where: {
      deletedAt: null,
      status: SCHEDULED,
      startAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { startAt: 'asc' },
  });
  for (const row of popupPub) {
    const r = await prisma.popup.updateMany({
      where: {
        id: row.id,
        status: SCHEDULED,
        deletedAt: null,
        startAt: { not: null, lte: now },
      },
      data: { status: PUBLISHED, publishedAt: now },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'popup',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'publish',
        previousStatus: SCHEDULED,
        nextStatus: PUBLISHED,
      });
    }
  }

  // ── Popup: PUBLISHED → ARCHIVED ───────────────────────────────────────────

  const popupArch = await prisma.popup.findMany({
    where: {
      deletedAt: null,
      status: PUBLISHED,
      endAt: { not: null, lte: now },
    },
    select: { id: true, tenantId: true, mallId: true },
    take: batchSize,
    orderBy: { endAt: 'asc' },
  });
  for (const row of popupArch) {
    const r = await prisma.popup.updateMany({
      where: {
        id: row.id,
        status: PUBLISHED,
        deletedAt: null,
        endAt: { not: null, lte: now },
      },
      data: { status: ARCHIVED },
    });
    if (r.count === 1) {
      transitions.push({
        kind: 'popup',
        id: row.id,
        tenantId: row.tenantId,
        mallId: row.mallId,
        action: 'archive',
        previousStatus: PUBLISHED,
        nextStatus: ARCHIVED,
      });
    }
  }

  return { transitions };
}
