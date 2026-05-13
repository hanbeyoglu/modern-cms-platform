import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { MediaService } from './media.service';
import { MediaFolderService } from './media-folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { ListFoldersDto, ListMediaDto } from './dto/list-media.dto';
import { MAX_FILE_SIZE_BYTES } from './constants/media.constants';

@Controller('media')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly folders: MediaFolderService,
  ) {}

  // ─── Asset endpoints ────────────────────────────────────────────────────────

  @Post('upload')
  @RequirePermission('media:upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Req() req: Request,
    @Body('folderId') folderId?: string,
    @Body('altText') altText?: string,
  ) {
    return this.media.uploadAsset(file, user, req.tenantId!, {
      folderId,
      mallId: req.mallId,
      altText,
    });
  }

  @Get()
  @RequirePermission('media:read')
  async list(@CurrentUser() _user: User, @Req() req: Request, @Query() query: ListMediaDto) {
    // x-mall-id acts as a filter when provided
    const effectiveQuery: ListMediaDto = {
      ...query,
      ...(req.mallId && !query.mallId ? { mallId: req.mallId } : {}),
    };
    return this.media.listAssets(req.tenantId!, effectiveQuery);
  }

  @Get('folders')
  @RequirePermission('media:read')
  async listFolders(@Req() req: Request, @Query() query: ListFoldersDto) {
    return this.folders.listFolders(req.tenantId!, query);
  }

  @Post('folders')
  @RequirePermission('media:upload')
  async createFolder(
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.folders.createFolder(dto, user, req.tenantId!);
  }

  // NOTE: /:id routes are declared after /folders to prevent NestJS matching
  // "folders" as an id parameter.

  @Get(':id')
  @RequirePermission('media:read')
  async getOne(@Param('id') id: string, @Req() req: Request) {
    return this.media.getAsset(id, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('media:delete')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.media.deleteAsset(id, user, req.tenantId!);
  }
}
