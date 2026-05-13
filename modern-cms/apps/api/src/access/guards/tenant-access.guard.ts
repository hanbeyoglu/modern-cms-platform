import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { AccessService } from '../access.service';
import { IS_PUBLIC_KEY, REQUIRE_TENANT_CONTEXT_KEY } from '../../common/metadata-keys';

@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_CONTEXT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requireTenant) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user: User }>();
    const user = req.user;
    if (!user) {
      return false;
    }

    const tenantId = req.tenantId;
    if (!tenantId && !user.isSuperAdmin) {
      throw new ForbiddenException('x-tenant-id başlığı gerekli');
    }

    if (tenantId) {
      await this.access.assertTenantAccess(user, tenantId);
    }

    return true;
  }
}
