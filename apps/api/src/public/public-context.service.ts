import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Mall, Tenant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicContext {
  tenantId: string;
  mallId: string | undefined;
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'status'>;
  mall: Pick<Mall, 'id' | 'name' | 'slug' | 'status'> | undefined;
}

@Injectable()
export class PublicContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    tenantId: string | undefined,
    mallId: string | undefined,
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

    return { tenantId: tenant.id, mallId: mall?.id, tenant, mall };
  }
}
