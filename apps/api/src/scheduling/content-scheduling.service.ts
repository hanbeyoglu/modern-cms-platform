import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../audit/audit.service';
import { PublicCacheService } from '../public/cache/public-cache.service';
import { ContentPublishService } from './content-publish.service';
import type { ScheduleTransition } from '@modern-cms/content-scheduling';

@Injectable()
export class ContentSchedulingService {
  private readonly logger = new Logger(ContentSchedulingService.name);

  constructor(
    private readonly publish: ContentPublishService,
    private readonly audit: AuditLogService,
    private readonly cache: PublicCacheService,
  ) {}

  /**
   * Runs one scheduling sweep: DB transitions + audit + public cache invalidation.
   * Intended for manual smoke tests; production ticks run in the worker app.
   */
  async executeTick(opts?: { now?: Date; batchSize?: number }): Promise<{
    transitions: number;
  }> {
    const { transitions } = await this.publish.runTransitionTick(opts);
    for (const t of transitions) {
      await this.writeAudit(t);
      await this.invalidateFor(t);
    }
    if (transitions.length > 0) {
      this.logger.log(`Scheduling tick applied ${transitions.length} transition(s)`);
    }
    return { transitions: transitions.length };
  }

  private async writeAudit(t: ScheduleTransition): Promise<void> {
    const action = `${t.kind}:auto-${t.action === 'publish' ? 'publish' : 'archive'}`;
    await this.audit.logAction({
      tenantId: t.tenantId,
      mallId: t.mallId ?? undefined,
      action,
      entityType: t.kind,
      entityId: t.id,
      before: { status: t.previousStatus },
      after: { status: t.nextStatus, scheduledExecution: true },
    });
  }

  private async invalidateFor(t: ScheduleTransition): Promise<void> {
    const mallKey = t.mallId ?? 'none';
    await this.cache.invalidatePublicKey(`public:${t.tenantId}:${mallKey}:*`);
  }
}
