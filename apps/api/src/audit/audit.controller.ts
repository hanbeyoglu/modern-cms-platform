import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { AuditLogService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import {
  ApiAdminOperation,
  ApiPaginationQuery,
  ApiUuidParam,
} from '../swagger/swagger.decorators';

@ApiTags(SWAGGER_TAGS.AUDIT)
@ApiBearerAuth('JWT')
@Controller('audit-logs')
@RequireTenantContext()
@UseGuards(TenantAccessGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  @RequirePermission('audit:read')
  @ApiAdminOperation({ summary: 'audit.list.summary',
    description: 'Paginated audit log listing with filters for actor, entity, action, and date range.',
    permissions: ['audit:read'],
  })
  @ApiPaginationQuery()
  @ApiResponse({ status: 200, description: 'audit.response.200' })
  list(
    @CurrentUser() actor: User & { isSuperAdmin: boolean; memberships?: Array<{ tenantId: string }> },
    @Query() query: ListAuditLogsDto,
    @Headers('x-tenant-id') contextTenantId?: string,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? undefined : contextTenantId;
    return this.audit.list(actor, query, scopedTenantId);
  }

  @Get('recent-activity')
  @RequirePermission('audit:read')
  @ApiAdminOperation({ summary: 'audit.get.summary',
    description: 'Returns the most recent audit entries for dashboard widgets.',
    permissions: ['audit:read'],
  })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Tenant UUID (super admin only).' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of entries (default 10).', schema: { type: 'integer', default: 10 } })
  @ApiResponse({ status: 200, description: 'audit.response.200' })
  recentActivity(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
    @Headers('x-tenant-id') contextTenantId?: string,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? tenantId : contextTenantId;
    return this.audit.recentActivity(scopedTenantId, limit ? parseInt(limit, 10) : 10);
  }

  @Get('security-events')
  @RequirePermission('audit:security')
  @ApiAdminOperation({ summary: 'audit.get.summary',
    description: 'Returns recent security-related audit events (login failures, permission denials, etc.).',
    permissions: ['audit:security'],
  })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Tenant UUID (super admin only).' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of entries (default 10).', schema: { type: 'integer', default: 10 } })
  @ApiResponse({ status: 200, description: 'audit.response.200' })
  securityEvents(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
    @Headers('x-tenant-id') contextTenantId?: string,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? tenantId : contextTenantId;
    return this.audit.securityEvents(scopedTenantId, limit ? parseInt(limit, 10) : 10);
  }

  @Get('timeline/:entityType/:entityId')
  @RequirePermission('audit:read')
  @ApiAdminOperation({ summary: 'audit.get.summary',
    description: 'Returns chronological audit history for a specific entity (campaign, page, user, etc.).',
    permissions: ['audit:read'],
  })
  @ApiResponse({ status: 200, description: 'audit.response.200' })
  timeline(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Headers('x-tenant-id') contextTenantId?: string,
  ) {
    return this.audit.timeline(entityType, entityId, actor, actor.isSuperAdmin ? undefined : contextTenantId);
  }

  @Get('export')
  @RequirePermission('audit:export')
  @ApiAdminOperation({ summary: 'audit.export.audit.logs.summary',
    description: 'Downloads audit logs as JSON or CSV attachment. Uses the same filters as the list endpoint.',
    permissions: ['audit:export'],
  })
  @ApiQuery({ name: 'format', required: false, description: 'Export format: `json` or `csv` (default json).', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } })
  @ApiResponse({ status: 200, description: 'audit.response.200' })
  async export(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Query() query: ListAuditLogsDto,
    @Res() res: Response,
    @Headers('x-tenant-id') contextTenantId?: string,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? undefined : contextTenantId;
    const format = query.format ?? 'json';

    if (format === 'csv') {
      const csv = await this.audit.exportCsv(actor, query, scopedTenantId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.send(csv);
    }

    const data = await this.audit.exportJson(actor, query, scopedTenantId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
    return res.json(data);
  }

  @Get(':id')
  @RequirePermission('audit:read')
  @ApiAdminOperation({ summary: 'audit.get.summary',
    permissions: ['audit:read'],
  })
  @ApiUuidParam('id', 'common.param.uuid')
  @ApiResponse({ status: 200, description: 'audit.response.200' })
  async findOne(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Param('id') id: string,
    @Headers('x-tenant-id') contextTenantId?: string,
  ) {
    const log = await this.audit.findOne(id, actor, actor.isSuperAdmin ? undefined : contextTenantId);
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }

}
