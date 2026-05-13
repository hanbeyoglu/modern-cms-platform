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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';

@Controller('events')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @RequirePermission('event:read')
  list(@Req() req: Request, @Query() query: ListEventsDto) {
    return this.events.list(req.tenantId!, req.mallId, query);
  }

  @Get(':id')
  @RequirePermission('event:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.events.findOne(id, req.tenantId!, req.mallId);
  }

  @Post()
  @RequirePermission('event:create')
  create(@Body() dto: CreateEventDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.events.create(dto, user, req.tenantId!, req.mallId);
  }

  @Patch(':id')
  @RequirePermission('event:update')
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
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.events.remove(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/publish')
  @RequirePermission('event:publish')
  publish(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.events.publish(id, user, req.tenantId!, req.mallId);
  }

  @Post(':id/archive')
  @RequirePermission('event:archive')
  archive(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.events.archive(id, user, req.tenantId!, req.mallId);
  }
}
