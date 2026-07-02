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
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { ListMoviesDto } from './dto/list-movies.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.MOVIES)
@ApiAdminContext()
@Controller('movies')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  @RequirePermission('movie:read')
  @ApiAdminOperation({ summary: 'movie.list.summary',
    permissions: ['movie:read'],
    related: [SWAGGER_TAGS.MOVIE_SESSIONS, SWAGGER_TAGS.CINEMAS],
  })
  @ApiResponse({ status: 200, description: 'movie.response.200' })
  list(@Req() req: Request, @Query() query: ListMoviesDto) {
    return this.movies.list(req.tenantId!, { ...query, mallId: req.mallId ?? query.mallId });
  }

  @Get('categories')
  @RequirePermission('movie:read')
  @ApiAdminOperation({ summary: 'movie.categories.summary',
    permissions: ['movie:read'],
    related: [SWAGGER_TAGS.MOVIES],
  })
  @ApiResponse({ status: 200, description: 'movie.response.200' })
  categories(@Req() req: Request) {
    return this.movies.listCategories(req.tenantId!);
  }

  @Get(':id')
  @RequirePermission('movie:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movie.get.summary',
    permissions: ['movie:read'],
    related: [SWAGGER_TAGS.MOVIE_SESSIONS],
  })
  @ApiResponse({ status: 200, description: 'movie.response.200' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.movies.findOne(id, req.tenantId!);
  }

  @Post()
  @RequirePermission('movie:create')
  @ApiAdminOperation({ summary: 'movie.create.summary',
    permissions: ['movie:create'],
  })
  @ApiResponse({ status: 201, description: 'movie.response.201' })
  create(@Body() dto: CreateMovieDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.movies.create(dto, user, req.tenantId!);
  }

  @Patch(':id')
  @RequirePermission('movie:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movie.update.summary', permissions: ['movie:update'] })
  @ApiResponse({ status: 200, description: 'movie.response.200' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMovieDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.movies.update(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('movie:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'movie.delete.summary', permissions: ['movie:delete'] })
  @ApiResponse({ status: 204, description: 'movie.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.movies.remove(id, user, req.tenantId!);
  }
}
