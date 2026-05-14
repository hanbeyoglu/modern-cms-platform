import { Injectable, Logger } from '@nestjs/common';
import {
  runContentSchedulingTick,
  type RunContentSchedulingTickOptions,
  type RunContentSchedulingTickResult,
} from '@modern-cms/content-scheduling';
import { PrismaService } from '../prisma/prisma.service';

/** Stateless Prisma transitions (publish/archive). Used by the worker and API orchestrator. */
@Injectable()
export class ContentPublishService {
  private readonly logger = new Logger(ContentPublishService.name);

  constructor(private readonly prisma: PrismaService) {}

  runTransitionTick(opts?: RunContentSchedulingTickOptions): Promise<RunContentSchedulingTickResult> {
    this.logger.log(
      `Scheduling tick invoked (batchSize=${opts?.batchSize ?? 'default'}, now=${opts?.now?.toISOString() ?? 'default'})`,
    );
    return runContentSchedulingTick(this.prisma, opts);
  }
}
