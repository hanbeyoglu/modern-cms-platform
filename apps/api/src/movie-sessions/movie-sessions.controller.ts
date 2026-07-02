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
import { MovieSessionsService } from './movie-sessions.service';
import { CreateMovieSessionDto } from './dto/create-movie-session.dto';
import { UpdateMovieSessionDto } from './dto/update-movie-session.dto';
import { ListMovieSessionsDto } from './dto/list-movie-sessions.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.MOVIE_SESSIONS)
@ApiAdminContext()
@Controller('movie-sessions')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MovieSessionsController {
  constructor(private readonly sessions: MovieSessionsService) {}

  @Get()
  @RequirePermission('movie-session:read')
  @ApiAdminOperation({ summary: 'movieSession.list.summary',
    permissions: ['movie-session:read'],
    related: [SWAGGER_TAGS.MOVIES, SWAGGER_TAGS.CINEMAS],
  })
  @ApiResponse({ status: 200, description: 'movieSession.response.200' })
  list(@Req() req: Request, @Query() query: ListMovieSessionsDto) {
    return this.sessions.list(req.tenantId!, req.mallId!, query);
  }

  @Post()
  @RequirePermission('movie-session:create')
  @ApiAdminOperation({ summary: 'movieSession.create.summary',
    permissions: ['movie-session:create'],
    related: [SWAGGER_TAGS.MOVIES, SWAGGER_TAGS.CINEMAS],
  })
  @ApiResponse({ status: 201, description: 'movieSession.response.201' })
  create(@Body() dto: CreateMovieSessionDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.sessions.create(dto, user, req.tenantId!, req.mallId!);
  }

  @Post(':id/cancel')
  @RequirePermission('movie-session:cancel')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.cancel.movie.session.summary', permissions: ['movie-session:cancel'] })
  @ApiResponse({ status: 200, description: 'movieSession.response.200' })
  cancel(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    return this.sessions.cancel(id, user, req.tenantId!, req.mallId!);
  }

  @Get(':id')
  @RequirePermission('movie-session:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.get.summary',
    permissions: ['movie-session:read'],
    related: [SWAGGER_TAGS.MOVIES, SWAGGER_TAGS.CINEMAS],
  })
  @ApiResponse({ status: 200, description: 'movieSession.response.200' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.sessions.findOne(id, req.tenantId!, req.mallId!);
  }

  @Patch(':id')
  @RequirePermission('movie-session:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.update.summary', permissions: ['movie-session:update'] })
  @ApiResponse({ status: 200, description: 'movieSession.response.200' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMovieSessionDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sessions.update(id, dto, user, req.tenantId!, req.mallId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('movie-session:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.delete.summary', permissions: ['movie-session:delete'] })
  @ApiResponse({ status: 204, description: 'movieSession.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.sessions.remove(id, user, req.tenantId!, req.mallId!);
  }
}
