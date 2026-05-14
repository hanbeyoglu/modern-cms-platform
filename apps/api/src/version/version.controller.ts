import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';

@Controller('version')
export class VersionController {
  constructor(private readonly config: ConfigService) {}

  @Public()
  @Get()
  getVersion() {
    return {
      name: 'modern-cms-api',
      version: this.config.get<string>('APP_VERSION') ?? '0.0.0',
      gitSha: this.config.get<string>('APP_GIT_SHA') ?? 'unknown',
      buildTime: this.config.get<string>('APP_BUILD_TIME') ?? 'unknown',
      nodeEnv: this.config.get<string>('NODE_ENV') ?? 'development',
    };
  }
}
