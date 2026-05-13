import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';

@Controller('campaigns')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermission('campaign:read')
  list(@Req() req: Request, @Query() query: ListCampaignsDto) {
    return this.campaigns.list(req.tenantId!, req.mallId, query);
  }

  @Get(':id')
  @RequirePermission('campaign:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.campaigns.findOne(id, req.tenantId!, req.mallId);
  }

  @Post()
  @RequirePermission('campaign:create')
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.campaigns.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('campaign:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.campaigns.update(id, dto, user, req.tenantId!, req.mallId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('campaign:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.campaigns.remove(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/publish')
  @RequirePermission('campaign:publish')
  publish(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.campaigns.publish(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/archive')
  @RequirePermission('campaign:archive')
  archive(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.campaigns.archive(id, user, req.tenantId!, req.mallId);
  }
}
