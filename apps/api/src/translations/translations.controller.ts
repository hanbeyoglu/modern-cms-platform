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
import { TranslationsService } from './translations.service';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { ListTranslationsDto } from './dto/list-translations.dto';

@Controller('translations')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Get()
  @RequirePermission('translation:read')
  list(@Req() req: Request, @Query() query: ListTranslationsDto) {
    return this.translations.list(req.tenantId!, query);
  }

  @Post()
  @RequirePermission('translation:create')
  upsert(@Body() dto: CreateTranslationDto, @CurrentUser() user: User, @Req() req: Request) {
    return this.translations.upsert(dto, user, req.tenantId!);
  }

  @Patch(':id')
  @RequirePermission('translation:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTranslationDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.translations.update(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('translation:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.translations.remove(id, user, req.tenantId!);
  }
}
