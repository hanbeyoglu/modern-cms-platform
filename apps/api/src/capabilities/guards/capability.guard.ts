import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { CAPABILITY_KEY } from '../../common/metadata-keys';
import { CapabilitiesService } from '../capabilities.service';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly capabilities: CapabilitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request & { user: User }>();
    const user = req.user;
    if (!user) return false;

    // Super admin always passes — platform admin bypass
    if (user.isSuperAdmin) return true;

    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Yetenek kontrolü için x-tenant-id başlığı gerekli');
    }

    const enabled = await this.capabilities.getEnabledCodesForTenant(tenantId);
    if (!enabled.has(required)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'FEATURE_NOT_ENABLED',
        message: `Bu özellik tenant için etkin değil: ${required}`,
      });
    }
    return true;
  }
}
