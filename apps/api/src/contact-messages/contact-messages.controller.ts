import { Controller, Get, Header, Param, Patch, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { RequireMallContext } from '../common/decorators/require-mall.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { MallAccessGuard } from '../access/guards/mall-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { ApiAdminContext } from '../swagger/swagger.decorators';
import { ContactMessagesService } from './contact-messages.service';
import { ListContactMessagesDto, UpdateContactMessageStatusDto } from './dto/contact-message.dto';

@ApiTags('İletişim Mesajları')
@ApiAdminContext()
@Controller('contact-messages')
@RequireTenantContext()
@RequireMallContext()
@UseGuards(TenantAccessGuard, MallAccessGuard, PermissionsGuard)
export class ContactMessagesController {
  constructor(private readonly messages: ContactMessagesService) {}
  @ApiOperation({
    summary: 'List contact messages',
    description: 'Paginated inbox scoped to the selected tenant and authorized mall.',
  })
  @Get()
  @Header('Cache-Control', 'no-store')
  @RequirePermission('contact-message:read')
  list(@Req() req: Request, @Query() query: ListContactMessagesDto) {
    return this.messages.list(req.tenantId, req.mallId, query);
  }
  @ApiOperation({ summary: 'Count new contact messages' })
  @Get('unread-count')
  @Header('Cache-Control', 'no-store')
  @RequirePermission('contact-message:read')
  count(@Req() req: Request) {
    return this.messages.unreadCount(req.tenantId, req.mallId);
  }
  @ApiOperation({
    summary: 'Read contact message',
    description: 'Marks NEW messages READ, recording readAt.',
  })
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @RequirePermission('contact-message:read')
  detail(@Req() req: Request, @Param('id') id: string) {
    return this.messages.detail(req.tenantId, req.mallId, id);
  }
  @ApiOperation({
    summary: 'Change contact message status',
    description: 'Mark NEW/READ, archive or restore. No permanent deletion.',
  })
  @Patch(':id/status')
  @Header('Cache-Control', 'no-store')
  @RequirePermission('contact-message:update')
  status(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateContactMessageStatusDto) {
    return this.messages.updateStatus(req.tenantId, req.mallId, id, dto.status);
  }
}
