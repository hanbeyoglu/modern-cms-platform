import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Debug-only endpoints used to validate the permission and access architecture.
 * Disabled in production unless ENABLE_DEBUG_ENDPOINTS=true is explicitly set.
 */
@Controller('access/debug')
@UseGuards(PermissionsGuard)
export class AccessController {
  constructor(private readonly config: ConfigService) {}

  private assertDebugEnabled(): void {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const enabled = this.config.get<string>('ENABLE_DEBUG_ENDPOINTS') === 'true';
    if (isProd && !enabled) {
      throw new NotFoundException();
    }
  }

  @Get('me')
  debugMe(@CurrentUser() user: User) {
    this.assertDebugEnabled();
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      status: user.status,
    };
  }

  @Get('analytics')
  @RequirePermission('analytics:view')
  debugAnalytics(@CurrentUser() user: User) {
    this.assertDebugEnabled();
    return { ok: true, endpoint: 'analytics', requiredPermission: 'analytics:view', userId: user.id };
  }

  @Post('content-publish')
  @HttpCode(200)
  @RequirePermission('content:publish')
  debugContentPublish(@CurrentUser() user: User) {
    this.assertDebugEnabled();
    return {
      ok: true,
      endpoint: 'content-publish',
      requiredPermission: 'content:publish',
      userId: user.id,
    };
  }
}
