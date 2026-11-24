import { Injectable } from '@nestjs/common';
import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { buildCorsOptions } from './cors-options';
import { parseCorsOrigins } from './cors-origins';

/** Panel-managed domains apply only to public routes, never to admin authentication. */
@Injectable()
export class PublicCorsService {
  constructor(private readonly prisma: PrismaService) {}

  createOptions(environmentOrigins: string): CorsOptionsDelegate<Request> {
    const base = buildCorsOptions(environmentOrigins);
    const staticOrigins = parseCorsOrigins(environmentOrigins);
    return (req, callback) => {
      void this.resolveOrigin(req, staticOrigins).then(
        origin => callback(null, { ...base, origin }),
        // DB failure must not open CORS or replace a normal API response with a 500.
        () => callback(null, { ...base, origin: false }),
      );
    };
  }

  private async resolveOrigin(req: Request, staticOrigins: Array<string | RegExp>): Promise<CorsOptions['origin']> {
    const origin = req.headers.origin;
    if (!origin) return false;
    if (staticOrigins.some(entry => typeof entry === 'string' ? entry === origin : entry.test(origin))) {
      return origin;
    }
    const path = (req.originalUrl || req.url).split('?')[0];
    if (path !== '/public' && !path.startsWith('/public/')) return false;
    let url: URL;
    try { url = new URL(origin); } catch { return false; }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return false;

    // Preflight carries header names, not the tenant/API key header values.
    // Exact registered hostname is sufficient for CORS; PublicApiKeyGuard still
    // checks the actual API key's tenant and its own domain list on the GET/POST.
    // Read on each request so panel changes take effect across API instances immediately.
    const match = await this.prisma.allowedDomain.findFirst({
      where: {
        domain: url.hostname,
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
    });
    return match ? origin : false;
  }
}
