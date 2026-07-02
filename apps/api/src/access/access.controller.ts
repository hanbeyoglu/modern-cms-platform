import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from './guards/permissions.guard';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation } from '../swagger/swagger.decorators';

/**
 * Debug-only endpoints used to validate the permission and access architecture.
 * Disabled in production unless ENABLE_DEBUG_ENDPOINTS=true is explicitly set.
 */
@ApiTags(SWAGGER_TAGS.PERMISSIONS)
@ApiAdminContext()
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
  @ApiAdminOperation({ summary: 'access.debug.current.user.profile.summary',
    description: 'Returns the authenticated user object. **Debug only** — disabled in production unless `ENABLE_DEBUG_ENDPOINTS=true`.',
  })
  @ApiResponse({ status: 200, description: 'access.response.200' })
  @ApiResponse({ status: 404, description: 'access.response.404' })
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
  @ApiAdminOperation({ summary: 'access.debug.analytics.permission.probe.summary',
    description: 'Validates that the `analytics:view` permission gate works. **Debug only**.',
    permissions: ['analytics:view'],
  })
  @ApiResponse({ status: 200, description: 'access.response.200' })
  debugAnalytics(@CurrentUser() user: User) {
    this.assertDebugEnabled();
    return { ok: true, endpoint: 'analytics', requiredPermission: 'analytics:view', userId: user.id };
  }

  @Post('content-publish')
  @HttpCode(200)
  @RequirePermission('content:publish')
  @ApiAdminOperation({ summary: 'access.publish.summary',
    description: 'Validates that the `content:publish` permission gate works. **Debug only**.',
    permissions: ['content:publish'],
  })
  @ApiResponse({ status: 200, description: 'access.response.200' })
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
