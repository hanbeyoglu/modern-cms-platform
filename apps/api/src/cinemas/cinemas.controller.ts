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
import { CinemasService } from './cinemas.service';
import { CreateCinemaDto } from './dto/create-cinema.dto';
import { UpdateCinemaDto } from './dto/update-cinema.dto';
import { ListCinemasDto } from './dto/list-cinemas.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.CINEMAS)
@ApiAdminContext()
@Controller('cinemas')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class CinemasController {
  constructor(private readonly cinemas: CinemasService) {}

  @Get()
  @RequirePermission('cinema:read')
  @ApiAdminOperation({ summary: 'cinema.list.summary',
    permissions: ['cinema:read'],
    related: [SWAGGER_TAGS.MOVIES, SWAGGER_TAGS.MOVIE_SESSIONS],
  })
  @ApiResponse({ status: 200, description: 'cinema.response.200' })
  list(@Req() req: Request, @Query() query: ListCinemasDto) {
    return this.cinemas.list(req.tenantId!, req.mallId!, query);
  }

  @Get(':id')
  @RequirePermission('cinema:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'cinema.get.summary',
    permissions: ['cinema:read'],
    related: [SWAGGER_TAGS.MOVIE_SESSIONS],
  })
  @ApiResponse({ status: 200, description: 'cinema.response.200' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.cinemas.findOne(id, req.tenantId!, req.mallId!);
  }

  @Post()
  @RequirePermission('cinema:create')
  @ApiAdminOperation({ summary: 'cinema.create.summary',
    permissions: ['cinema:create'],
  })
  @ApiResponse({ status: 201, description: 'cinema.response.201' })
  create(@Body() dto: CreateCinemaDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.cinemas.create(dto, user, req.tenantId!, req.mallId!);
  }

  @Patch(':id')
  @RequirePermission('cinema:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'cinema.update.summary', permissions: ['cinema:update'] })
  @ApiResponse({ status: 200, description: 'cinema.response.200' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCinemaDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.cinemas.update(id, dto, user, req.tenantId!, req.mallId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('cinema:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'cinema.delete.summary', permissions: ['cinema:delete'] })
  @ApiResponse({ status: 204, description: 'cinema.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.cinemas.remove(id, user, req.tenantId!, req.mallId!);
  }
}
