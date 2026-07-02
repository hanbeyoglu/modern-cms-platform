import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { isAuditEnabled } from '../common/utils/audit-enabled.util';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { VersionResponseDto } from '../swagger/dto/common-response.dto';

@ApiTags(SWAGGER_TAGS.VERSION)
@Controller('version')
export class VersionController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'version.get.summary',
    description:
      'Returns CMS version, git commit, build time, and enabled feature flags. Used by the Developer Portal version panel.',
  })
  @ApiResponse({ status: 200, type: VersionResponseDto })
  getVersion() {
    return {
      name: 'modern-cms-api',
      version: this.config.get<string>('APP_VERSION') ?? '0.0.0',
      gitSha: this.config.get<string>('APP_GIT_SHA') ?? 'unknown',
      buildTime: this.config.get<string>('APP_BUILD_TIME') ?? 'unknown',
      nodeEnv: this.config.get<string>('NODE_ENV') ?? 'development',
      features: {
        auditEnabled: isAuditEnabled(this.config),
      },
    };
  }
}
