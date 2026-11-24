import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { PublicCacheService } from '../public/cache/public-cache.service';

@Injectable()
export class AnalyticsRateLimitGuard implements CanActivate {
  constructor(private readonly cache: PublicCacheService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const ip = req.ip || req.socket?.remoteAddress;
    if (!ip) throw new ServiceUnavailableException('Ölçüm geçici olarak kullanılamıyor');
    const count = await this.cache.increment(
      `analytics-rate:${req.tenantId}:${req.mallId}:${createHash('sha256').update(ip).digest('hex')}`,
      60,
    );
    if (!count) throw new ServiceUnavailableException('Ölçüm geçici olarak kullanılamıyor');
    if (count > 120) {
      res.setHeader('Retry-After', '60');
      throw new HttpException('Ölçüm istek sınırı aşıldı', 429);
    }
    return true;
  }
}
