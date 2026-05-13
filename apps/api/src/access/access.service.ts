import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Mall, Tenant, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALL_MALLS_ROLE_CODES = new Set(['TENANT_ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveUserById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null, status: 'ACTIVE' },
    });
  }

  async findActiveUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null, status: 'ACTIVE' },
    });
  }

  async assertTenantAccess(user: User, tenantId: string): Promise<void> {
    if (user.isSuperAdmin) {
      const count = await this.prisma.tenant.count({ where: { id: tenantId, deletedAt: null } });
      if (count === 0) {
        throw new NotFoundException('Tenant bulunamadı');
      }
      return;
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, tenantId, deletedAt: null },
      include: { tenant: true },
    });
    if (!tenantUser || tenantUser.tenant.deletedAt) {
      throw new UnauthorizedException('Bu tenant için erişim yok');
    }
  }

  async assertMallAccess(user: User, tenantId: string, mallId: string): Promise<Mall> {
    const mall = await this.prisma.mall.findFirst({
      where: { id: mallId, tenantId, deletedAt: null },
    });
    if (!mall) {
      throw new NotFoundException('Mall bulunamadı');
    }

    if (user.isSuperAdmin) {
      return mall;
    }

    await this.assertTenantAccess(user, tenantId);

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, tenantId, deletedAt: null },
      include: { role: true },
    });
    if (!tenantUser) {
      throw new UnauthorizedException('Bu tenant için erişim yok');
    }

    if (ALL_MALLS_ROLE_CODES.has(tenantUser.role.code)) {
      return mall;
    }

    const access = await this.prisma.userMallAccess.findFirst({
      where: { tenantUserId: tenantUser.id, mallId },
    });
    if (!access) {
      throw new UnauthorizedException('Bu mall için erişim yok');
    }
    return mall;
  }

  async getEffectivePermissionCodes(user: User, tenantId: string): Promise<Set<string>> {
    if (user.isSuperAdmin) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      return new Set(all.map((p) => p.code));
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, tenantId, deletedAt: null },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });
    if (!tenantUser) {
      return new Set();
    }
    return new Set(tenantUser.role.rolePermissions.map((rp) => rp.permission.code));
  }

  async listTenantsForUser(user: User): Promise<Tenant[]> {
    if (user.isSuperAdmin) {
      return this.prisma.tenant.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
    }
    const links = await this.prisma.tenantUser.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { tenant: true },
    });
    return links.map((l) => l.tenant).filter((t) => !t.deletedAt);
  }

  async listMallsForUser(user: User, tenantId?: string): Promise<Mall[]> {
    if (user.isSuperAdmin) {
      if (tenantId) {
        await this.assertTenantAccess(user, tenantId);
        return this.prisma.mall.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { name: 'asc' },
        });
      }
      return this.prisma.mall.findMany({
        where: { deletedAt: null },
        orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
      });
    }

    if (!tenantId) {
      throw new UnauthorizedException('x-tenant-id başlığı gerekli');
    }

    await this.assertTenantAccess(user, tenantId);

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id, tenantId, deletedAt: null },
      include: { role: true },
    });
    if (!tenantUser) {
      throw new UnauthorizedException('Bu tenant için erişim yok');
    }

    if (ALL_MALLS_ROLE_CODES.has(tenantUser.role.code)) {
      return this.prisma.mall.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.mall.findMany({
      where: {
        deletedAt: null,
        tenantId,
        userMallAccesses: { some: { tenantUserId: tenantUser.id } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
