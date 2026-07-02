import { Controller, Get, HttpCode, Logger, Res } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiKeyOperation } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.HEALTH)
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @HttpCode(200)
  @ApiKeyOperation('health.health.summary')
  @ApiResponse({ status: 200, description: 'health.response.200' })
  async getHealth() {
    const snapshot = await this.health.getSnapshot();
    if (snapshot.status === 'down') {
      this.logger.warn(`Health degraded: database=${snapshot.database}`);
    } else if (snapshot.status === 'degraded') {
      this.logger.warn(`Health degraded: redis=${snapshot.redis}`);
    }
    return snapshot;
  }

  @Public()
  @Get('ready')
  @ApiKeyOperation('health.ready.summary')
  @ApiResponse({ status: 200, description: 'health.response.200' })
  @ApiResponse({ status: 503, description: 'health.response.503' })
  async getReady(@Res({ passthrough: true }) res: Response) {
    const { ok, snapshot } = await this.health.isReady();
    if (!ok) {
      res.status(503);
      this.logger.warn(`Readiness failed db=${snapshot.database} redis=${snapshot.redis}`);
    }
    return snapshot;
  }
}
