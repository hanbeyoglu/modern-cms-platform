import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.header('x-correlation-id') ?? randomUUID()).trim();
    const requestId = randomUUID();
    req.correlationId = correlationId;
    req.requestId = requestId;
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);
    next();
  }
}
