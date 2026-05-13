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
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { MoviesService } from './movies.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { UpdateMovieDto } from './dto/update-movie.dto';
import { ListMoviesDto } from './dto/list-movies.dto';

@Controller('movies')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class MoviesController {
  constructor(private readonly movies: MoviesService) {}

  @Get()
  @RequirePermission('movie:read')
  list(@Req() req: Request, @Query() query: ListMoviesDto) {
    return this.movies.list(req.tenantId!, query);
  }

  @Get(':id')
  @RequirePermission('movie:read')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.movies.findOne(id, req.tenantId!);
  }

  @Post()
  @RequirePermission('movie:create')
  create(@Body() dto: CreateMovieDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.movies.create(dto, user, req.tenantId!);
  }

  @Patch(':id')
  @RequirePermission('movie:update')
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
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.movies.remove(id, user, req.tenantId!);
  }
}
