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
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { ApiAdminContext, ApiAdminOperation, ApiUuidParam } from '../swagger/swagger.decorators';
import { MovieSessionsService } from './movie-sessions.service';
import { ListMovieSessionsDto } from './dto/list-movie-sessions.dto';
import { CreateMovieSessionForMovieDto } from './dto/create-movie-session-for-movie.dto';
import { UpdateMovieSessionForMovieDto } from './dto/update-movie-session-for-movie.dto';

@ApiTags(SWAGGER_TAGS.MOVIE_SESSIONS)
@ApiAdminContext()
@Controller('movies/:movieId/sessions')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MovieSessionsByMovieController {
  constructor(private readonly sessions: MovieSessionsService) {}

  @Get()
  @RequirePermission('movie:read')
  @ApiUuidParam('movieId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.list.summary', permissions: ['movie:read'] })
  @ApiResponse({ status: 200, description: 'movieSession.response.200' })
  list(@Param('movieId') movieId: string, @Req() req: Request, @Query() query: ListMovieSessionsDto) {
    return this.sessions.listForMovie(movieId, req.tenantId!, req.mallId!, query);
  }

  @Post()
  @RequirePermission('movie:update')
  @ApiUuidParam('movieId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.create.summary', permissions: ['movie:update'] })
  @ApiResponse({ status: 201, description: 'movieSession.response.201' })
  create(
    @Param('movieId') movieId: string,
    @Body() dto: CreateMovieSessionForMovieDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sessions.createForMovie(movieId, dto, user, req.tenantId!, req.mallId!);
  }

  @Patch(':sessionId')
  @RequirePermission('movie:update')
  @ApiUuidParam('movieId', 'common.param.uuid')
  @ApiUuidParam('sessionId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.update.summary', permissions: ['movie:update'] })
  @ApiResponse({ status: 200, description: 'movieSession.response.200' })
  update(
    @Param('movieId') movieId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateMovieSessionForMovieDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.sessions.updateForMovie(movieId, sessionId, dto, user, req.tenantId!, req.mallId!);
  }

  @Delete(':sessionId')
  @HttpCode(204)
  @RequirePermission('movie:update')
  @ApiUuidParam('movieId', 'common.param.uuid')
  @ApiUuidParam('sessionId', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movieSession.delete.summary', permissions: ['movie:update'] })
  @ApiResponse({ status: 204, description: 'movieSession.response.204' })
  async remove(
    @Param('movieId') movieId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    await this.sessions.removeForMovie(movieId, sessionId, user, req.tenantId!, req.mallId!);
  }
}
