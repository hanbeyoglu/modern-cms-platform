import { Controller, Get, HttpCode, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly health: HealthService) {}

  /** Liveness + dependency snapshot (HTTP 200; use `status` field for orchestration logic). */
  @Public()
  @Get()
  @HttpCode(200)
  async getHealth() {
    const snapshot = await this.health.getSnapshot();
    if (snapshot.status === 'down') {
      this.logger.warn(`Health degraded: database=${snapshot.database}`);
    } else if (snapshot.status === 'degraded') {
      this.logger.warn(`Health degraded: redis=${snapshot.redis}`);
    }
    return snapshot;
  }

  /** Readiness: 503 unless database (and Redis when configured) are up. */
  @Public()
  @Get('ready')
  async getReady(@Res({ passthrough: true }) res: Response) {
    const { ok, snapshot } = await this.health.isReady();
    if (!ok) {
      res.status(503);
      this.logger.warn(`Readiness failed db=${snapshot.database} redis=${snapshot.redis}`);
    }
    return snapshot;
  }
}
