import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';
import { DemoContentService } from './demo-content.service';
import { DemoImportDto } from './dto/demo-import.dto';
import { MallContentResetDto } from './dto/mall-content-reset.dto';

@ApiTags(SWAGGER_TAGS.MALLS)
@ApiAdminContext()
@Controller('locations/:mallId/demo-content')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class DemoContentController {
  constructor(private readonly demoContent: DemoContentService) {}

  private scope(req: Request, mallId: string) {
    return { tenantId: req.tenantId!, mallId };
  }

  @Post('preview')
  @RequirePermission('demo:import')
  @ApiUuidParam('mallId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'Demo içerik önizleme (dry-run)',
    permissions: ['demo:import'],
  })
  @ApiResponse({ status: 200, description: 'Demo import önizlemesi' })
  preview(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Param('mallId') mallId: string,
    @Body() body: DemoImportDto,
  ) {
    const { tenantId } = this.scope(req, mallId);
    return this.demoContent.previewImport(user, tenantId, mallId, body.shiftDates === true);
  }

  @Post('apply')
  @RequirePermission('demo:import')
  @ApiUuidParam('mallId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'Demo içerik yüklemeyi başlat',
    permissions: ['demo:import'],
  })
  apply(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Param('mallId') mallId: string,
    @Body() body: DemoImportDto,
  ) {
    const { tenantId } = this.scope(req, mallId);
    return this.demoContent.startImport(user, tenantId, mallId, body.shiftDates === true);
  }

  @Post('remove')
  @RequirePermission('demo:remove')
  @ApiUuidParam('mallId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'Demo verilerini kaldır',
    permissions: ['demo:remove'],
  })
  remove(@CurrentUser() user: User, @Req() req: Request, @Param('mallId') mallId: string) {
    const { tenantId } = this.scope(req, mallId);
    return this.demoContent.removeDemo(user, tenantId, mallId);
  }

  @Get('batches')
  @RequirePermission('demo:import')
  @ApiUuidParam('mallId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'Demo içerik batch listesi',
    description: 'Seçilen lokasyon için son demo import/remove/reset işlemlerini listeler.',
    permissions: ['demo:import'],
  })
  @ApiResponse({ status: 200, description: 'Demo batch listesi' })
  listBatches(@CurrentUser() user: User, @Req() req: Request, @Param('mallId') mallId: string) {
    const { tenantId } = this.scope(req, mallId);
    return this.demoContent.listBatches(user, tenantId, mallId);
  }

  @Get('batches/:batchId')
  @RequirePermission('demo:import')
  @ApiUuidParam('mallId', 'common.param.uuid')
  @ApiUuidParam('batchId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'Demo içerik batch durumu',
    description: 'Async demo import job durumunu ve raporu döner.',
    permissions: ['demo:import'],
  })
  @ApiResponse({ status: 200, description: 'Demo batch detayı' })
  getBatch(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Param('mallId') mallId: string,
    @Param('batchId') batchId: string,
  ) {
    const { tenantId } = this.scope(req, mallId);
    return this.demoContent.getBatch(user, tenantId, mallId, batchId);
  }

  @Post('reset/preview')
  @RequirePermission('mall:content-reset')
  @ApiUuidParam('mallId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'AVM içerik sıfırlama önizleme (Super Admin)',
    permissions: ['mall:content-reset'],
  })
  resetPreview(@CurrentUser() user: User, @Req() req: Request, @Param('mallId') mallId: string) {
    const { tenantId } = this.scope(req, mallId);
    return this.demoContent.previewReset(user, tenantId, mallId);
  }

  @Post('reset')
  @RequirePermission('mall:content-reset')
  @ApiUuidParam('mallId', 'common.param.uuid')
  @ApiAdminOperation({
    summary: 'AVM içeriklerini sıfırla (Super Admin)',
    permissions: ['mall:content-reset'],
  })
  reset(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Param('mallId') mallId: string,
    @Body() body: MallContentResetDto,
  ) {
    const { tenantId } = this.scope(req, mallId);
    return this.demoContent.resetMallContent(
      user,
      tenantId,
      mallId,
      body.confirmName,
      body.confirmAgain,
    );
  }
}
