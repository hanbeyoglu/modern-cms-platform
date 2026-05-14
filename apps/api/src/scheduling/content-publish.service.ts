import { Injectable } from '@nestjs/common';
import {
  runContentSchedulingTick,
  type RunContentSchedulingTickOptions,
  type RunContentSchedulingTickResult,
} from '@modern-cms/content-scheduling';
import { PrismaService } from '../prisma/prisma.service';

/** Stateless Prisma transitions (publish/archive). Used by the worker and API orchestrator. */
@Injectable()
export class ContentPublishService {
  constructor(private readonly prisma: PrismaService) {}

  runTransitionTick(opts?: RunContentSchedulingTickOptions): Promise<RunContentSchedulingTickResult> {
    return runContentSchedulingTick(this.prisma, opts);
  }
}
