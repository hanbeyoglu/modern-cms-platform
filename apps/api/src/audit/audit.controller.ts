import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { AuditLogService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Controller('audit-logs')
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  @RequirePermission('audit:read')
  list(
    @CurrentUser() actor: User & { isSuperAdmin: boolean; memberships?: Array<{ tenantId: string }> },
    @Query() query: ListAuditLogsDto,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? undefined : this.getActorTenantId(actor, query.tenantId);
    return this.audit.list(actor, query, scopedTenantId);
  }

  @Get('recent-activity')
  @RequirePermission('audit:read')
  recentActivity(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? tenantId : undefined;
    return this.audit.recentActivity(scopedTenantId, limit ? parseInt(limit, 10) : 10);
  }

  @Get('security-events')
  @RequirePermission('audit:security')
  securityEvents(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? tenantId : undefined;
    return this.audit.securityEvents(scopedTenantId, limit ? parseInt(limit, 10) : 10);
  }

  @Get('timeline/:entityType/:entityId')
  @RequirePermission('audit:read')
  timeline(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.audit.timeline(entityType, entityId, actor, actor.isSuperAdmin ? undefined : undefined);
  }

  @Get('export')
  @RequirePermission('audit:export')
  async export(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Query() query: ListAuditLogsDto,
    @Res() res: Response,
  ) {
    const scopedTenantId = actor.isSuperAdmin ? undefined : this.getActorTenantId(actor, query.tenantId);
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
  async findOne(
    @CurrentUser() actor: User & { isSuperAdmin: boolean },
    @Param('id') id: string,
  ) {
    const log = await this.audit.findOne(id, actor, actor.isSuperAdmin ? undefined : undefined);
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }

  private getActorTenantId(actor: User & { memberships?: Array<{ tenantId: string }> }, queriedTenantId?: string): string | null {
    if (queriedTenantId && actor.memberships?.some((m) => m.tenantId === queriedTenantId)) {
      return queriedTenantId;
    }
    return actor.memberships?.[0]?.tenantId ?? null;
  }
}
