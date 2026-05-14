import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { ListUsersDto } from './dto/list-users.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto, UpdateUserStatusDto } from './dto/update-user.dto';
import type { CreateMembershipDto, UpdateMembershipDto } from './dto/membership.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(actor: User, query: ListUsersDto) {
    const { search, roleId, tenantId, mallId, status } = query;

    // Non-super admins can only see users in their tenant
    const scopedTenantId = actor.isSuperAdmin ? tenantId : await this.resolveSingleTenantId(actor);

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (scopedTenantId || roleId || mallId) {
      where.tenantUsers = {
        some: {
          deletedAt: null,
          ...(scopedTenantId ? { tenantId: scopedTenantId } : {}),
          ...(roleId ? { roleId } : {}),
          ...(mallId
            ? { mallAccess: { some: { mallId } } }
            : {}),
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        tenantUsers: {
          where: { deletedAt: null },
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            role: { select: { id: true, code: true, name: true } },
            mallAccess: {
              include: { mall: { select: { id: true, name: true, slug: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return { users: users.map((u) => this.formatUser(u)) };
  }

  async findOne(actor: User, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        tenantUsers: {
          where: { deletedAt: null },
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            role: { select: { id: true, code: true, name: true } },
            mallAccess: {
              include: { mall: { select: { id: true, name: true, slug: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    if (!actor.isSuperAdmin) {
      const actorTenantId = await this.resolveSingleTenantId(actor);
      const inSameTenant = user.tenantUsers.some((tu) => tu.tenantId === actorTenantId);
      if (!inSameTenant) throw new ForbiddenException('Bu kullanıcıya erişim yok');
    }

    return this.formatUser(user);
  }

  async create(actor: User, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Bu e-posta adresi zaten kullanılıyor');

    // Non-super admins can only create users in their own tenant
    if (!actor.isSuperAdmin && dto.tenantId) {
      const actorTenantId = await this.resolveSingleTenantId(actor);
      if (dto.tenantId !== actorTenantId) {
        throw new ForbiddenException('Yalnızca kendi tenant\'ınızda kullanıcı oluşturabilirsiniz');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: 'ACTIVE',
      },
    });

    if (dto.tenantId && dto.roleId) {
      await this.addMembership(actor, user.id, {
        tenantId: dto.tenantId,
        roleId: dto.roleId,
        mallIds: dto.mallIds,
      });
    }

    await this.audit.logAction({
      userId: actor.id,
      action: 'user_created',
      entityType: 'user',
      entityId: user.id,
      after: { email: user.email, firstName: user.firstName, lastName: user.lastName },
    });

    return this.findOne(actor, user.id);
  }

  async update(actor: User, userId: string, dto: UpdateUserDto) {
    const user = await this.findOne(actor, userId);

    const before = { firstName: user.firstName, lastName: user.lastName };
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName, lastName: dto.lastName },
    });

    await this.audit.logAction({
      userId: actor.id,
      action: 'user_updated',
      entityType: 'user',
      entityId: userId,
      before,
      after: { firstName: dto.firstName, lastName: dto.lastName },
    });

    return this.findOne(actor, updated.id);
  }

  async updateStatus(actor: User, userId: string, dto: UpdateUserStatusDto) {
    if (userId === actor.id) {
      throw new BadRequestException('Kendi hesabınızın durumunu değiştiremezsiniz');
    }
    const user = await this.findOne(actor, userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
    });

    await this.audit.logAction({
      userId: actor.id,
      action: dto.status === 'ACTIVE' ? 'user_activated' : 'user_deactivated',
      entityType: 'user',
      entityId: userId,
      before: { status: user.status },
      after: { status: dto.status },
    });

    return { success: true, status: dto.status };
  }

  async addMembership(actor: User, userId: string, dto: CreateMembershipDto) {
    if (!actor.isSuperAdmin) {
      const actorTenantId = await this.resolveSingleTenantId(actor);
      if (dto.tenantId !== actorTenantId) {
        throw new ForbiddenException('Yalnızca kendi tenant\'ınızda üyelik oluşturabilirsiniz');
      }
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('Tenant bulunamadı');

    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, isActive: true },
    });
    if (!role) throw new NotFoundException('Rol bulunamadı');

    const existing = await this.prisma.tenantUser.findFirst({
      where: { tenantId: dto.tenantId, userId, deletedAt: null },
    });
    if (existing) throw new ConflictException('Bu kullanıcı zaten bu tenant\'ta üye');

    const membership = await this.prisma.tenantUser.create({
      data: { tenantId: dto.tenantId, userId, roleId: dto.roleId, isActive: true },
    });

    if (dto.mallIds?.length) {
      const malls = await this.prisma.mall.findMany({
        where: { id: { in: dto.mallIds }, tenantId: dto.tenantId, deletedAt: null },
      });
      await this.prisma.userMallAccess.createMany({
        data: malls.map((m) => ({ tenantUserId: membership.id, mallId: m.id })),
        skipDuplicates: true,
      });
    }

    await this.audit.logAction({
      userId: actor.id,
      tenantId: dto.tenantId,
      action: 'membership_created',
      entityType: 'tenant_user',
      entityId: membership.id,
      after: { tenantId: dto.tenantId, roleId: dto.roleId, mallIds: dto.mallIds },
    });

    return { success: true, membershipId: membership.id };
  }

  async updateMembership(
    actor: User,
    userId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    const membership = await this.prisma.tenantUser.findFirst({
      where: { id: membershipId, userId, deletedAt: null },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    if (!actor.isSuperAdmin) {
      const actorTenantId = await this.resolveSingleTenantId(actor);
      if (membership.tenantId !== actorTenantId) {
        throw new ForbiddenException('Bu üyeliğe erişim yok');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.roleId !== undefined) updateData.roleId = dto.roleId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const before = { roleId: membership.roleId, isActive: membership.isActive };
    await this.prisma.tenantUser.update({ where: { id: membershipId }, data: updateData });

    if (dto.mallIds !== undefined) {
      await this.prisma.userMallAccess.deleteMany({ where: { tenantUserId: membershipId } });
      if (dto.mallIds.length) {
        const malls = await this.prisma.mall.findMany({
          where: { id: { in: dto.mallIds }, tenantId: membership.tenantId, deletedAt: null },
        });
        await this.prisma.userMallAccess.createMany({
          data: malls.map((m) => ({ tenantUserId: membershipId, mallId: m.id })),
          skipDuplicates: true,
        });
      }
    }

    await this.audit.logAction({
      userId: actor.id,
      tenantId: membership.tenantId,
      action: 'membership_updated',
      entityType: 'tenant_user',
      entityId: membershipId,
      before,
      after: updateData,
    });

    return { success: true };
  }

  async removeMembership(actor: User, userId: string, membershipId: string) {
    const membership = await this.prisma.tenantUser.findFirst({
      where: { id: membershipId, userId, deletedAt: null },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    if (!actor.isSuperAdmin) {
      const actorTenantId = await this.resolveSingleTenantId(actor);
      if (membership.tenantId !== actorTenantId) {
        throw new ForbiddenException('Bu üyeliğe erişim yok');
      }
    }

    await this.prisma.tenantUser.update({
      where: { id: membershipId },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: actor.id,
      tenantId: membership.tenantId,
      action: 'membership_removed',
      entityType: 'tenant_user',
      entityId: membershipId,
    });

    return { success: true };
  }

  // Placeholder — real email sending deferred
  async resetPassword(actor: User, userId: string) {
    await this.findOne(actor, userId);
    await this.audit.logAction({
      userId: actor.id,
      action: 'password_reset_requested',
      entityType: 'user',
      entityId: userId,
    });
    return { success: true, message: 'Password reset token placeholder' };
  }

  private async resolveSingleTenantId(actor: User): Promise<string> {
    const tu = await this.prisma.tenantUser.findFirst({
      where: { userId: actor.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!tu) throw new ForbiddenException('Tenant üyeliği bulunamadı');
    return tu.tenantId;
  }

  private formatUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
    isSuperAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
    tenantUsers: Array<{
      id: string;
      tenantId: string;
      isActive: boolean;
      createdAt: Date;
      tenant: { id: string; name: string; slug: string };
      role: { id: string; code: string; name: string };
      mallAccess: Array<{ mall: { id: string; name: string; slug: string } }>;
    }>;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      memberships: user.tenantUsers.map((tu) => ({
        id: tu.id,
        tenantId: tu.tenantId,
        tenantName: tu.tenant.name,
        tenantSlug: tu.tenant.slug,
        role: tu.role,
        isActive: tu.isActive,
        malls: tu.mallAccess.map((a) => a.mall),
        createdAt: tu.createdAt,
      })),
    };
  }
}
