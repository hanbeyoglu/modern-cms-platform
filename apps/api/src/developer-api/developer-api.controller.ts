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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../access/guards/tenant-access.guard';
import { PermissionsGuard } from '../access/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequireTenantContext } from '../common/decorators/require-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SWAGGER_TAGS } from '../swagger/swagger.constants';
import { DeveloperApiService } from './developer-api.service';
import {
  CreateAllowedDomainDto,
  CreateApiKeyDto,
  ListApiLogsDto,
  UpdateApiKeyDto,
  UpdateRateLimitDto,
} from './dto/developer-api.dto';
import type { User } from '@prisma/client';

@ApiTags(SWAGGER_TAGS.DEVELOPER_API)
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
@RequireTenantContext()
@Controller('developer-api')
export class DeveloperApiController {
  constructor(private readonly service: DeveloperApiService) {}

  // ── API Keys ──────────────────────────────────────────────────────────────

  @Get('keys')
  @RequirePermission('settings:read')
  @ApiOperation({ summary: 'List API keys for the active tenant' })
  listKeys(@CurrentUser() user: User, @Query('tenantId') tenantId: string) {
    return this.service.listApiKeys(user, tenantId);
  }

  @Post('keys')
  @RequirePermission('settings:update')
  @ApiOperation({ summary: 'Create a new API key (raw key shown only once)' })
  createKey(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.service.createApiKey(user, tenantId, dto);
  }

  @Patch('keys/:id')
  @RequirePermission('settings:update')
  @ApiOperation({ summary: 'Update API key name/description/status' })
  updateKey(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.service.updateApiKey(user, tenantId, id, dto);
  }

  @Post('keys/:id/revoke')
  @RequirePermission('settings:update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke an API key permanently' })
  revokeKey(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.revokeApiKey(user, tenantId, id);
  }

  @Post('keys/:id/regenerate')
  @RequirePermission('settings:update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke current key and issue a new one (raw key shown once)' })
  regenerateKey(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.regenerateApiKey(user, tenantId, id);
  }

  @Delete('keys/:id')
  @RequirePermission('settings:update')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an API key record' })
  async deleteKey(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    await this.service.deleteApiKey(user, tenantId, id);
  }

  // ── Allowed Domains ───────────────────────────────────────────────────────

  @Get('domains')
  @RequirePermission('settings:read')
  @ApiOperation({ summary: 'List allowed domains for Public API CORS' })
  listDomains(@CurrentUser() user: User, @Query('tenantId') tenantId: string) {
    return this.service.listAllowedDomains(user, tenantId);
  }

  @Post('domains')
  @RequirePermission('settings:update')
  @ApiOperation({ summary: 'Add an allowed domain' })
  addDomain(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Body() dto: CreateAllowedDomainDto,
  ) {
    return this.service.addAllowedDomain(user, tenantId, dto);
  }

  @Delete('domains/:id')
  @RequirePermission('settings:update')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove an allowed domain' })
  async removeDomain(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    await this.service.removeAllowedDomain(user, tenantId, id);
  }

  // ── Rate Limits ───────────────────────────────────────────────────────────

  @Get('rate-limit')
  @RequirePermission('settings:read')
  @ApiOperation({ summary: 'Get current rate limit configuration' })
  getRateLimit(@CurrentUser() user: User, @Query('tenantId') tenantId: string) {
    return this.service.getRateLimit(user, tenantId);
  }

  @Patch('rate-limit')
  @RequirePermission('settings:update')
  @ApiOperation({ summary: 'Update rate limit (requests per minute)' })
  updateRateLimit(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Body() dto: UpdateRateLimitDto,
  ) {
    return this.service.updateRateLimit(user, tenantId, dto);
  }

  // ── API Logs ──────────────────────────────────────────────────────────────

  @Get('logs')
  @RequirePermission('settings:read')
  @ApiOperation({ summary: 'List recent Public API request logs' })
  listLogs(
    @CurrentUser() user: User,
    @Query('tenantId') tenantId: string,
    @Query() query: ListApiLogsDto,
  ) {
    return this.service.listApiLogs(user, tenantId, query);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('analytics')
  @RequirePermission('settings:read')
  @ApiOperation({ summary: 'Developer API usage analytics' })
  getAnalytics(@CurrentUser() user: User, @Query('tenantId') tenantId: string) {
    return this.service.getAnalytics(user, tenantId);
  }
}
