import { Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequireCapability } from '../capabilities/decorators/require-capability.decorator';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiPaginationQuery,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiAdminContext()
@Controller('notifications')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard, CapabilityGuard)
@RequireCapability('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermission('notification:read')
  @ApiAdminOperation({ summary: 'notification.list.summary',
    description: 'Paginated inbox of in-app notifications for the current user.',
    permissions: ['notification:read'],
  })
  @ApiPaginationQuery()
  @ApiResponse({ status: 200, description: 'notification.response.200' })
  list(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notifications.list(user, req.tenantId!, req.mallId, query);
  }

  @Get('unread-count')
  @RequirePermission('notification:read')
  @ApiAdminOperation({ summary: 'notification.get.summary',
    description: 'Returns the number of unread notifications for badge display.',
    permissions: ['notification:read'],
  })
  @ApiResponse({ status: 200, description: 'notification.response.200' })
  unreadCount(@CurrentUser() user: User, @Req() req: Request) {
    return this.notifications.unreadCount(user, req.tenantId!, req.mallId);
  }

  @Patch(':id/read')
  @RequirePermission('notification:update')
  @ApiAdminOperation({ summary: 'notification.mark.notification.as.read.summary',
    permissions: ['notification:update'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'notification.response.200' })
  markRead(@CurrentUser() user: User, @Req() req: Request, @Param('id') id: string) {
    return this.notifications.markRead(user, req.tenantId!, req.mallId, id);
  }

  @Patch('read-all')
  @RequirePermission('notification:update')
  @ApiAdminOperation({ summary: 'notification.mark.all.notifications.as.read.summary',
    permissions: ['notification:update'],
  })
  @ApiResponse({ status: 200, description: 'notification.response.200' })
  markAllRead(@CurrentUser() user: User, @Req() req: Request) {
    return this.notifications.markAllRead(user, req.tenantId!, req.mallId);
  }

  @Delete(':id')
  @RequirePermission('notification:delete')
  @ApiAdminOperation({ summary: 'notification.delete.summary',
    description: 'Soft-deletes a notification from the user inbox.',
    permissions: ['notification:delete'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'notification.response.200' })
  remove(@CurrentUser() user: User, @Req() req: Request, @Param('id') id: string) {
    return this.notifications.softDelete(user, req.tenantId!, req.mallId, id);
  }
}
