import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { MallsService } from './malls.service';

@Controller('malls')
@RequireTenantContext()
@Permissions('mall:read')
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MallsController {
  constructor(private readonly malls: MallsService) {}

  @Get('my')
  async my(@CurrentUser() user: User, @Req() req: Request) {
    return this.malls.my(user, req.tenantId);
  }
}
