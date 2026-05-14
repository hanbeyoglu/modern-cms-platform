import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Locale, Mall, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationResolverService } from '../translation-resolver/translation-resolver.service';

export interface PublicContext {
  tenantId: string;
  mallId: string | undefined;
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'status'>;
  mall: Pick<Mall, 'id' | 'name' | 'slug' | 'status'> | undefined;
  // null when the tenant has no active locale configured
  locale: { id: string; code: string; rtl: boolean } | null;
  defaultLocale: { id: string; code: string; rtl: boolean } | null;
}

@Injectable()
export class PublicContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: TranslationResolverService,
  ) {}

  async resolve(
    tenantId: string | undefined,
    mallId: string | undefined,
    localeCode?: string,
  ): Promise<PublicContext> {
    if (!tenantId?.trim()) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId.trim(), deletedAt: null },
      select: { id: true, name: true, slug: true, status: true },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status !== 'ACTIVE') {
      throw new BadRequestException('Tenant is not active');
    }

    let mall: Pick<Mall, 'id' | 'name' | 'slug' | 'status'> | undefined;

    if (mallId?.trim()) {
      const mallRow = await this.prisma.mall.findFirst({
        where: { id: mallId.trim(), tenantId: tenant.id, deletedAt: null },
        select: { id: true, name: true, slug: true, status: true },
      });
      if (!mallRow) throw new NotFoundException('Mall not found for this tenant');
      if (mallRow.status !== 'LIVE') {
        throw new BadRequestException('Mall is not currently live');
      }
      mall = mallRow;
    }

    // Resolve locale: requested code → active locale or fall back to tenant default
    const resolved = await this.resolver.resolveLocale(tenant.id, localeCode);

    // Fetch default locale only when the resolved locale is not already the default
    const defaultLocale =
      resolved?.isDefault === true
        ? resolved
        : await this.resolver.getDefaultLocale(tenant.id);

    const toCtx = (l: Locale | null) => (l ? { id: l.id, code: l.code, rtl: l.rtl } : null);

    return {
      tenantId: tenant.id,
      mallId: mall?.id,
      tenant,
      mall,
      locale: toCtx(resolved),
      defaultLocale: toCtx(defaultLocale),
    };
  }
}
