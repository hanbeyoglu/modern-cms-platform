import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { AuditLogService } from './audit.service';
import { AUDIT_ACTION_KEY } from '../common/metadata-keys';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request & { user?: User }>();

    return next.handle().pipe(
      tap(() => {
        void this.audit.logAction({
          userId: req.user?.id,
          tenantId: req.tenantId,
          mallId: req.mallId,
          action,
          entityType: context.getClass().name.replace('Controller', '').toLowerCase(),
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
      }),
    );
  }
}
