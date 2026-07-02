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
import { ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.CAMPAIGNS)
@ApiAdminContext()
@Controller('campaigns')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @RequirePermission('campaign:read')
  @ApiAdminOperation({ summary: 'campaign.list.summary',
    permissions: ['campaign:read'],
    related: [SWAGGER_TAGS.STORES, SWAGGER_TAGS.MEDIA, SWAGGER_TAGS.PUBLIC],
  })
  @ApiResponse({ status: 200, description: 'campaign.response.200' })
  list(@Req() req: Request, @Query() query: ListCampaignsDto) {
    return this.campaigns.list(req.tenantId!, req.mallId, query);
  }

  @Get(':id')
  @RequirePermission('campaign:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'campaign.get.summary',
    permissions: ['campaign:read'],
    related: [SWAGGER_TAGS.MEDIA],
  })
  @ApiResponse({ status: 200, description: 'campaign.response.200' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.campaigns.findOne(id, req.tenantId!, req.mallId);
  }

  @Post()
  @RequirePermission('campaign:create')
  @ApiAdminOperation({ summary: 'campaign.create.summary',
    permissions: ['campaign:create'],
    related: [SWAGGER_TAGS.MEDIA, SWAGGER_TAGS.STORES],
  })
  @ApiResponse({ status: 201, description: 'campaign.response.201' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.campaigns.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('campaign:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'campaign.update.summary', permissions: ['campaign:update'] })
  @ApiResponse({ status: 200, description: 'campaign.response.200' })
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
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'campaign.delete.summary', permissions: ['campaign:delete'] })
  @ApiResponse({ status: 204, description: 'campaign.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.campaigns.remove(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/publish')
  @RequirePermission('campaign:publish')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'campaign.publish.summary',
    permissions: ['campaign:publish'],
    related: [SWAGGER_TAGS.PUBLIC],
  })
  @ApiResponse({ status: 200, description: 'campaign.response.200' })
  publish(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.campaigns.publish(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/archive')
  @RequirePermission('campaign:archive')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'campaign.archive.summary', permissions: ['campaign:archive'] })
  @ApiResponse({ status: 200, description: 'campaign.response.200' })
  archive(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.campaigns.archive(id, user, req.tenantId!, req.mallId);
  }
}
