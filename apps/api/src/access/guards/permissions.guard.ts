import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { AccessService } from '../access.service';
import { ANY_PERMISSIONS_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/metadata-keys';

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
    const anyRequired = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if ((!required || required.length === 0) && (!anyRequired || anyRequired.length === 0)) {
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

    if (required && required.length > 0) {
      for (const code of required) {
        if (!effective.has(code)) {
          throw new ForbiddenException(`Eksik yetki: ${code}`);
        }
      }
    }

    if (anyRequired && anyRequired.length > 0) {
      const hasAny = anyRequired.some((code) => effective.has(code));
      if (!hasAny) {
        throw new ForbiddenException(`Eksik yetki (en az biri gerekli): ${anyRequired.join(', ')}`);
      }
    }

    return true;
  }
}
