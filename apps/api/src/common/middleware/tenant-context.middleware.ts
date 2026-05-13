import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const tenantId = req.header('x-tenant-id')?.trim();
    const mallId = req.header('x-mall-id')?.trim();
    if (tenantId) {
      req.tenantId = tenantId;
    }
    if (mallId) {
      req.mallId = mallId;
    }
    next();
  }
}
