import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { AccessService } from '../access.service';
import { IS_PUBLIC_KEY, REQUIRE_MALL_CONTEXT_KEY } from '../../common/metadata-keys';

@Injectable()
export class MallAccessGuard implements CanActivate {
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

    const requireMall = this.reflector.getAllAndOverride<boolean>(REQUIRE_MALL_CONTEXT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requireMall) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user: User }>();
    const user = req.user;
    if (!user) {
      return false;
    }

    const mallId = req.mallId;
    if (!mallId) {
      return true;
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('x-mall-id ile birlikte x-tenant-id başlığı gerekli');
    }

    await this.access.assertMallAccess(user, tenantId, mallId);
    return true;
  }
}
