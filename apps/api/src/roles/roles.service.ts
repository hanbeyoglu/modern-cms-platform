import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto, UpdateRolePermissionsDto, CloneRoleDto } from './dto/update-role.dto';

const PERMISSION_GROUPS: Record<string, string[]> = {
  media: ['media:read', 'media:upload', 'media:delete'],
  sliders: ['slider:read', 'slider:create', 'slider:update', 'slider:delete', 'slider:publish', 'slider:reorder'],
  events: ['event:read', 'event:create', 'event:update', 'event:delete', 'event:publish', 'event:archive'],
  campaigns: ['campaign:read', 'campaign:create', 'campaign:update', 'campaign:delete', 'campaign:publish', 'campaign:archive'],
  stores: ['store-category:read', 'store-category:create', 'store-category:update', 'store-category:delete', 'global-store:read', 'global-store:create', 'global-store:update', 'global-store:delete', 'mall-store:read', 'mall-store:assign', 'mall-store:update', 'mall-store:delete', 'mall-store:feature'],
  pages: ['page:read', 'page:create', 'page:update', 'page:delete', 'page:publish', 'page:archive', 'page-block:read', 'page-block:create', 'page-block:update', 'page-block:delete', 'page-block:reorder'],
  analytics: ['analytics:view', 'analytics:export'],
  notifications: ['notification:read', 'notification:update', 'notification:delete'],
  localization: ['locale:read', 'locale:create', 'locale:update', 'locale:delete', 'locale:set-default', 'translation:read', 'translation:create', 'translation:update', 'translation:delete'],
  search: ['search:global'],
  users: ['user:read', 'user:create', 'user:update', 'user:delete'],
  roles: ['role:read', 'role:create', 'role:update', 'role:delete'],
  settings: ['settings:read', 'settings:update'],
  capabilities: ['capability:read', 'capability:update'],
  tenants: ['tenant:read', 'mall:read', 'mall:switch'],
};

const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

const CRITICAL_PLATFORM_PERMISSIONS = [
  'role:read',
  'role:create',
  'role:update',
  'role:delete',
  'user:read',
  'user:create',
  'user:update',
  'user:delete',
  'tenant:read',
  'tenant:create',
  'tenant:update',
  'tenant:delete',
  'settings:read',
  'settings:update',
  'capability:read',
  'capability:update',
];

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(actor: User, tenantId?: string) {
    const scopedTenantId = actor.isSuperAdmin ? tenantId : await this.resolveTenantId(actor);

    const roles = await this.prisma.role.findMany({
      where: {
        ...(actor.isSuperAdmin && !scopedTenantId
          ? {}
          : {
              OR: [
                { tenantId: null, isSystem: true },
                ...(scopedTenantId ? [{ tenantId: scopedTenantId }] : []),
              ],
            }),
      },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { tenantUsers: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return {
      roles: roles.map((r) => this.formatRole(r)),
    };
  }

  async findOne(actor: User, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { tenantUsers: true } },
      },
    });
    if (!role) throw new NotFoundException('Rol bulunamadı');

    if (!actor.isSuperAdmin && role.tenantId) {
      const actorTenantId = await this.resolveTenantId(actor);
      if (role.tenantId !== actorTenantId) throw new ForbiddenException('Bu role erişim yok');
    }

    return this.formatRole(role);
  }

  async create(actor: User, dto: CreateRoleDto) {
    const tenantId = actor.isSuperAdmin ? null : await this.resolveTenantId(actor);

    const codeBase = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const uniqueSuffix = Date.now().toString(36);
    const code = tenantId
      ? `tenant_${tenantId.slice(-6)}_${codeBase}_${uniqueSuffix}`
      : `custom_${codeBase}_${uniqueSuffix}`;

    const role = await this.prisma.role.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        isSystem: false,
        isActive: true,
        tenantId,
      },
    });

    if (dto.permissionIds?.length) {
      const perms = await this.prisma.permission.findMany({
        where: { id: { in: dto.permissionIds } },
      });
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    await this.audit.logAction({
      userId: actor.id,
      tenantId: tenantId ?? undefined,
      action: 'role_created',
      entityType: 'role',
      entityId: role.id,
      after: { name: role.name, tenantId },
    });

    return this.findOne(actor, role.id);
  }

  async update(actor: User, roleId: string, dto: UpdateRoleDto) {
    const role = await this.findOne(actor, roleId);
    await this.assertCanManageRole(actor, role);

    if (Object.prototype.hasOwnProperty.call(dto, 'code')) {
      throw new BadRequestException('Rol kodu değiştirilemez');
    }

    if (role.isSystem && dto.isActive === false) {
      await this.assertSystemRoleCanBeDeactivated(role);
    }

    const before = { name: role.name, description: role.description, isActive: role.isActive };
    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
      },
    });

    await this.audit.logAction({
      userId: actor.id,
      action: 'role_updated',
      entityType: 'role',
      entityId: roleId,
      before,
      after: { ...dto },
    });

    return this.findOne(actor, roleId);
  }

  async updatePermissions(actor: User, roleId: string, dto: UpdateRolePermissionsDto) {
    const role = await this.findOne(actor, roleId);
    await this.assertCanManageRole(actor, role);

    const perms = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });
    await this.assertSuperAdminCriticalPermissions(role, perms.map((p) => p.code));

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    await this.prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    });

    await this.audit.logAction({
      userId: actor.id,
      action: 'role_permissions_updated',
      entityType: 'role',
      entityId: roleId,
      after: { permissionIds: dto.permissionIds },
    });

    return this.findOne(actor, roleId);
  }

  async clone(actor: User, roleId: string, dto: CloneRoleDto) {
    const source = await this.findOne(actor, roleId);
    const tenantId = actor.isSuperAdmin ? source.tenantId : await this.resolveTenantId(actor);

    const codeBase = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const uniqueSuffix = Date.now().toString(36);
    const code = tenantId
      ? `tenant_${(tenantId as string).slice(-6)}_${codeBase}_${uniqueSuffix}`
      : `custom_${codeBase}_${uniqueSuffix}`;

    const cloned = await this.prisma.role.create({
      data: {
        code,
        name: dto.name,
        description: source.description ? `${source.description} (kopya)` : undefined,
        isSystem: false,
        isActive: true,
        tenantId: tenantId as string | null,
      },
    });

    // Copy permissions
    const sourcePerms = await this.prisma.rolePermission.findMany({
      where: { roleId },
    });
    if (sourcePerms.length) {
      await this.prisma.rolePermission.createMany({
        data: sourcePerms.map((rp) => ({ roleId: cloned.id, permissionId: rp.permissionId })),
        skipDuplicates: true,
      });
    }

    await this.audit.logAction({
      userId: actor.id,
      action: 'role_cloned',
      entityType: 'role',
      entityId: cloned.id,
      after: { sourceRoleId: roleId, name: dto.name },
    });

    return this.findOne(actor, cloned.id);
  }

  async remove(actor: User, roleId: string) {
    const role = await this.findOne(actor, roleId);
    await this.assertCanManageRole(actor, role);

    if (role.code === SUPER_ADMIN_ROLE_CODE) {
      throw new BadRequestException('SUPER_ADMIN rolü silinemez');
    }
    if (role.isSystem) {
      throw new BadRequestException('Sistem rolleri silinemez; güvenliyse pasifleştirilebilir');
    }

    const usageCount = await this.prisma.tenantUser.count({
      where: { roleId, deletedAt: null },
    });
    if (usageCount > 0) {
      throw new BadRequestException(`Bu rol ${usageCount} kullanıcı tarafından kullanılıyor`);
    }

    await this.prisma.role.delete({ where: { id: roleId } });

    await this.audit.logAction({
      userId: actor.id,
      action: 'role_deleted',
      entityType: 'role',
      entityId: roleId,
    });

    return { success: true };
  }

  async listPermissions() {
    const all = await this.prisma.permission.findMany({ orderBy: { code: 'asc' } });

    const grouped: Record<string, Array<{ id: string; code: string; description: string | null }>> = {};
    for (const [group, codes] of Object.entries(PERMISSION_GROUPS)) {
      const matched = all.filter((p) => codes.includes(p.code));
      if (matched.length) grouped[group] = matched;
    }

    // Catch any permissions not in the groups map
    const groupedCodes = new Set(Object.values(PERMISSION_GROUPS).flat());
    const ungrouped = all.filter((p) => !groupedCodes.has(p.code));
    if (ungrouped.length) grouped.other = ungrouped;

    return { permissions: all, groups: grouped };
  }

  private async resolveTenantId(actor: User): Promise<string> {
    const tu = await this.prisma.tenantUser.findFirst({
      where: { userId: actor.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!tu) throw new ForbiddenException('Tenant üyeliği bulunamadı');
    return tu.tenantId;
  }

  private async assertCanManageRole(
    actor: User,
    role: { tenantId: string | null; isSystem: boolean },
  ) {
    if (actor.isSuperAdmin) return;
    if (role.isSystem || !role.tenantId) {
      throw new ForbiddenException('Sistem rollerini yalnızca Super Admin düzenleyebilir');
    }

    const actorTenantId = await this.resolveTenantId(actor);
    if (role.tenantId !== actorTenantId) {
      throw new ForbiddenException('Bu rol yalnızca kendi tenantı içinde düzenlenebilir');
    }
  }

  private async assertSystemRoleCanBeDeactivated(role: { id: string; isSystem: boolean }) {
    if (!role.isSystem) return;

    const activeUsageCount = await this.prisma.tenantUser.count({
      where: {
        roleId: role.id,
        deletedAt: null,
        isActive: true,
        user: { deletedAt: null, status: 'ACTIVE' },
      },
    });
    if (activeUsageCount > 0) {
      throw new BadRequestException(
        `Bu sistem rolü ${activeUsageCount} aktif kullanıcı tarafından kullanılıyor; önce kullanıcıları başka role taşıyın`,
      );
    }
  }

  private async assertSuperAdminCriticalPermissions(
    role: { code: string; isActive: boolean },
    nextPermissionCodes: string[],
  ) {
    if (role.code !== SUPER_ADMIN_ROLE_CODE) return;
    if (!(await this.isLastEffectiveSuperAdminRole(role))) return;

    const next = new Set(nextPermissionCodes);
    const missing = CRITICAL_PLATFORM_PERMISSIONS.filter((code) => !next.has(code));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Son etkin SUPER_ADMIN rolünden kritik platform izinleri kaldırılamaz: ${missing.join(', ')}`,
      );
    }
  }

  private async isLastEffectiveSuperAdminRole(role: { code: string; isActive: boolean }) {
    if (role.code !== SUPER_ADMIN_ROLE_CODE || !role.isActive) return false;

    const effectiveSuperAdminRoles = await this.prisma.role.count({
      where: {
        code: SUPER_ADMIN_ROLE_CODE,
        isActive: true,
      },
    });

    return effectiveSuperAdminRoles === 1;
  }

  private formatRole(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    tenantId: string | null;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    rolePermissions: Array<{ permission: { id: string; code: string; description: string | null } }>;
    _count: { tenantUsers: number };
  }) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      tenantId: role.tenantId,
      isSystem: role.isSystem,
      isActive: role.isActive,
      usageCount: role._count.tenantUsers,
      permissions: role.rolePermissions.map((rp) => rp.permission),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
