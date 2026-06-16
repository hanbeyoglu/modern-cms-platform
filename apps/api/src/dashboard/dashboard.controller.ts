import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @RequirePermission('content:read')
  summary(@Req() req: Request) {
    if (!req.tenantId) {
      throw new BadRequestException('x-tenant-id başlığı gerekli');
    }
    return this.dashboard.summary(req.tenantId, req.mallId);
  }
}
