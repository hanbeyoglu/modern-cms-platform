import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { AccessService } from '../access.service';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/metadata-keys';

@Injectable()
export class PermissionsGuard implements CanActivate {
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

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user: User }>();
    const user = req.user;
    if (!user) {
      return false;
    }

    if (user.isSuperAdmin) {
      return true;
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Yetki kontrolü için x-tenant-id başlığı gerekli');
    }

    const effective = await this.access.getEffectivePermissionCodes(user, tenantId);
    for (const code of required) {
      if (!effective.has(code)) {
        throw new ForbiddenException(`Eksik yetki: ${code}`);
      }
    }
    return true;
  }
}
