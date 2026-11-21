import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { PublicCacheService } from '../cache/public-cache.service';
@Injectable()
export class ContactRateLimitGuard implements CanActivate {
  constructor(private readonly cache: PublicCacheService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    // Express derives req.ip through explicitly configured trusted proxies, never raw X-Forwarded-For.
    const ip = req.ip || req.socket.remoteAddress;
    if (!ip) throw new ServiceUnavailableException('Lütfen tekrar deneyin.');
    const key = `contact-rate:${req.tenantId}:${req.mallId}:${createHash('sha256').update(ip).digest('hex')}`;
    const count = await this.cache.increment(key, 600);
    if (!count)
      throw new ServiceUnavailableException('Mesaj gönderimi geçici olarak kullanılamıyor.');
    if (count > 5) {
      res.setHeader('Retry-After', '600');
      throw new HttpException('Çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin.', 429);
    }
    return true;
  }
}
