import { Controller, Delete, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Controller('notifications')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermission('notification:read')
  list(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Query() query: ListNotificationsDto,
  ) {
    return this.notifications.list(user, req.tenantId!, req.mallId, query);
  }

  @Get('unread-count')
  @RequirePermission('notification:read')
  unreadCount(@CurrentUser() user: User, @Req() req: Request) {
    return this.notifications.unreadCount(user, req.tenantId!, req.mallId);
  }

  @Patch(':id/read')
  @RequirePermission('notification:update')
  markRead(@CurrentUser() user: User, @Req() req: Request, @Param('id') id: string) {
    return this.notifications.markRead(user, req.tenantId!, req.mallId, id);
  }

  @Patch('read-all')
  @RequirePermission('notification:update')
  markAllRead(@CurrentUser() user: User, @Req() req: Request) {
    return this.notifications.markAllRead(user, req.tenantId!, req.mallId);
  }

  @Delete(':id')
  @RequirePermission('notification:delete')
  remove(@CurrentUser() user: User, @Req() req: Request, @Param('id') id: string) {
    return this.notifications.softDelete(user, req.tenantId!, req.mallId, id);
  }
}
