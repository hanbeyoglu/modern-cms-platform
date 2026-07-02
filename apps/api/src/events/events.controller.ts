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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.EVENTS)
@ApiAdminContext()
@Controller('events')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @RequirePermission('event:read')
  @ApiAdminOperation({ summary: 'event.list.summary',
    permissions: ['event:read'],
    related: [SWAGGER_TAGS.MEDIA, SWAGGER_TAGS.PUBLIC],
  })
  @ApiResponse({ status: 200, description: 'event.response.200' })
  list(@Req() req: Request, @Query() query: ListEventsDto) {
    return this.events.list(req.tenantId!, req.mallId, query);
  }

  @Get(':id')
  @RequirePermission('event:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'event.get.summary',
    permissions: ['event:read'],
    related: [SWAGGER_TAGS.MEDIA],
  })
  @ApiResponse({ status: 200, description: 'event.response.200' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.events.findOne(id, req.tenantId!, req.mallId);
  }

  @Post()
  @RequirePermission('event:create')
  @ApiAdminOperation({ summary: 'event.create.summary',
    permissions: ['event:create'],
    related: [SWAGGER_TAGS.MEDIA],
  })
  @ApiResponse({ status: 201, description: 'event.response.201' })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.events.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('event:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'event.update.summary', permissions: ['event:update'] })
  @ApiResponse({ status: 200, description: 'event.response.200' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.events.update(id, dto, user, req.tenantId!, req.mallId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('event:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'event.delete.summary', permissions: ['event:delete'] })
  @ApiResponse({ status: 204, description: 'event.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.events.remove(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/publish')
  @RequirePermission('event:publish')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'event.publish.summary',
    permissions: ['event:publish'],
    related: [SWAGGER_TAGS.PUBLIC],
  })
  @ApiResponse({ status: 200, description: 'event.response.200' })
  publish(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.events.publish(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/archive')
  @RequirePermission('event:archive')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'event.archive.summary', permissions: ['event:archive'] })
  @ApiResponse({ status: 200, description: 'event.response.200' })
  archive(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.events.archive(id, user, req.tenantId!, req.mallId);
  }
}
