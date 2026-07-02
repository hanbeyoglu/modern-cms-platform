import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { AuditLogService } from './audit.service';
import { AUDIT_ACTION_KEY } from '../common/metadata-keys';
import { isAuditEnabled } from '../common/utils/audit-enabled.util';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly enabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditLogService,
    config: ConfigService,
  ) {
    this.enabled = isAuditEnabled(config);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) {
      return next.handle();
    }

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
          source: 'api',
          correlationId: req.correlationId,
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
      }),
    );
  }
}
