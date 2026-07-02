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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
import { MediaService } from './media.service';
import { MediaFolderService } from './media-folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MoveMediaDto } from './dto/move-media.dto';
import { ListFoldersDto, ListMediaDto } from './dto/list-media.dto';
import { MAX_FILE_SIZE_BYTES } from './constants/media.constants';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminContext,
  ApiAdminOperation,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.MEDIA)
@ApiAdminContext()
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
  @ApiAdminOperation({ summary: 'media.upload.summary',
    permissions: ['media:upload'],
    related: [SWAGGER_TAGS.CAMPAIGNS, SWAGGER_TAGS.SLIDERS],
  })
  @ApiResponse({ status: 201, description: 'media.response.201' })
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
    @Body('usageContext') usageContext?: string,
    @Body('storageCategory') storageCategory?: string,
    @Body('suggestedWidth') suggestedWidth?: string,
    @Body('suggestedHeight') suggestedHeight?: string,
    @Body('tags') rawTags?: string,
  ) {
    return this.media.uploadAsset(file, user, req.tenantId!, {
      folderId,
      mallId: req.mallId,
      altText,
      usageContext,
      storageCategory,
      suggestedWidth: suggestedWidth ? parseInt(suggestedWidth, 10) : undefined,
      suggestedHeight: suggestedHeight ? parseInt(suggestedHeight, 10) : undefined,
      tags: rawTags ? (rawTags.startsWith('[') ? (JSON.parse(rawTags) as string[]) : rawTags.split(',').map((t) => t.trim()).filter(Boolean)) : undefined,
    });
  }

  @Get()
  @RequirePermission('media:read')
  @ApiAdminOperation({ summary: 'media.list.summary',
    permissions: ['media:read'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  async list(@CurrentUser() _user: User, @Req() req: Request, @Query() query: ListMediaDto) {
    const effectiveQuery: ListMediaDto = {
      ...query,
      ...(req.mallId && !query.mallId ? { mallId: req.mallId } : {}),
    };
    return this.media.listAssets(req.tenantId!, effectiveQuery);
  }

  // ─── Folder endpoints (before /:id to avoid route collision) ────────────────

  @Get('folders')
  @RequirePermission('media:read')
  @ApiAdminOperation({ summary: 'media.list.summary',
    permissions: ['media:read'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  async listFolders(@Req() req: Request, @Query() query: ListFoldersDto) {
    return this.folders.listFolders(req.tenantId!, query);
  }

  @Post('folders')
  @RequirePermission('media:manage-folders')
  @ApiAdminOperation({ summary: 'media.create.summary',
    permissions: ['media:manage-folders'],
  })
  @ApiResponse({ status: 201, description: 'media.response.201' })
  async createFolder(
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.folders.createFolder(dto, user, req.tenantId!);
  }

  @Patch('folders/:id')
  @RequirePermission('media:manage-folders')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'media.update.summary',
    permissions: ['media:manage-folders'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  async updateFolder(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.folders.updateFolder(id, dto, user, req.tenantId!);
  }

  @Delete('folders/:id')
  @HttpCode(204)
  @RequirePermission('media:manage-folders')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'media.delete.summary',
    permissions: ['media:manage-folders'],
  })
  @ApiResponse({ status: 204, description: 'media.response.204' })
  async deleteFolder(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    await this.folders.deleteFolder(id, user, req.tenantId!);
  }

  // ─── Asset by-id endpoints ──────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission('media:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'media.get.summary',
    permissions: ['media:read'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  async getOne(@Param('id') id: string, @Req() req: Request) {
    return this.media.getAsset(id, req.tenantId!);
  }

  @Get(':id/usages')
  @RequirePermission('media:read')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'media.get.summary',
    permissions: ['media:read'],
    related: [SWAGGER_TAGS.CAMPAIGNS, SWAGGER_TAGS.SLIDERS],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  async getUsages(@Param('id') id: string, @Req() req: Request) {
    return this.media.getUsages(id, req.tenantId!);
  }

  @Patch(':id')
  @RequirePermission('media:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'media.update.summary',
    permissions: ['media:update'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.media.updateAsset(id, dto, user, req.tenantId!);
  }

  @Patch(':id/move')
  @RequirePermission('media:update')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'media.move.media.asset.to.folder.summary',
    permissions: ['media:update'],
  })
  @ApiResponse({ status: 200, description: 'media.response.200' })
  async move(
    @Param('id') id: string,
    @Body() dto: MoveMediaDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    return this.media.moveAsset(id, dto, user, req.tenantId!);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('media:delete')
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiAdminOperation({ summary: 'media.delete.summary',
    permissions: ['media:delete'],
  })
  @ApiResponse({ status: 204, description: 'media.response.204' })
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.media.deleteAsset(id, user, req.tenantId!);
  }
}
