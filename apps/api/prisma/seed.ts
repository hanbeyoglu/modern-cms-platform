import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'tenant:read',
  'mall:read',
  'mall:switch',
  'user:read',
  'user:create',
  'role:read',
  'analytics:view',
  'content:read',
  'content:create',
  'content:update',
  'content:publish',
  'media:read',
  'media:upload',
  'media:delete',
  'slider:read',
  'slider:create',
  'slider:update',
  'slider:delete',
  'slider:publish',
  'slider:reorder',
] as const;

async function main(): Promise<void> {
  const passwordCost = 12;

  const permissionRows = await Promise.all(
    PERMISSIONS.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      }),
    ),
  );
  const permByCode = Object.fromEntries(permissionRows.map((p) => [p.code, p])) as unknown as Record<
    (typeof PERMISSIONS)[number],
    { id: string }
  >;

  const roleDefs: Array<{
    code: string;
    name: string;
    permissions: (typeof PERMISSIONS)[number][];
  }> = [
    {
      code: 'SUPER_ADMIN',
      name: 'Super Admin',
      permissions: [...PERMISSIONS],
    },
    {
      code: 'TENANT_ADMIN',
      name: 'Tenant Admin',
      permissions: [...PERMISSIONS],
    },
    {
      code: 'MALL_MANAGER',
      name: 'Mall Manager',
      permissions: [
        'mall:read',
        'mall:switch',
        'user:read',
        'analytics:view',
        'content:read',
        'content:create',
        'content:update',
        'content:publish',
        'media:read',
        'media:upload',
        'media:delete',
        'slider:read',
        'slider:create',
        'slider:update',
        'slider:delete',
        'slider:publish',
        'slider:reorder',
      ],
    },
    {
      code: 'CONTENT_EDITOR',
      name: 'Content Editor',
      permissions: [
        'mall:read',
        'mall:switch',
        'user:read',
        'content:read',
        'content:create',
        'content:update',
        'media:read',
        'media:upload',
        'slider:read',
        'slider:create',
        'slider:update',
      ],
    },
    {
      code: 'REPORT_VIEWER',
      name: 'Report Viewer',
      permissions: ['tenant:read', 'mall:read', 'analytics:view', 'media:read', 'slider:read'],
    },
  ];

  const roles: Record<string, { id: string }> = {};
  for (const def of roleDefs) {
    const role = await prisma.role.upsert({
      where: { code: def.code },
      update: { name: def.name },
      create: { code: def.code, name: def.name, isSystem: true },
    });
    roles[def.code] = role;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((code) => ({
        roleId: role.id,
        permissionId: permByCode[code].id,
      })),
    });
  }

  const tenantEmaar = await prisma.tenant.upsert({
    where: { slug: 'emaar-avm' },
    update: { name: 'Emaar AVM' },
    create: { name: 'Emaar AVM', slug: 'emaar-avm', status: 'ACTIVE' },
  });

  const tenantMallGroup = await prisma.tenant.upsert({
    where: { slug: 'mall-group' },
    update: { name: 'Mall Group' },
    create: { name: 'Mall Group', slug: 'mall-group', status: 'ACTIVE' },
  });

  const mallEmaar = await prisma.mall.upsert({
    where: { tenantId_slug: { tenantId: tenantEmaar.id, slug: 'emaar-avm' } },
    update: { name: 'Emaar AVM' },
    create: { tenantId: tenantEmaar.id, name: 'Emaar AVM', slug: 'emaar-avm', status: 'LIVE' },
  });

  const mallIstanbul = await prisma.mall.upsert({
    where: { tenantId_slug: { tenantId: tenantMallGroup.id, slug: 'mall-of-istanbul' } },
    update: { name: 'Mall of İstanbul' },
    create: {
      tenantId: tenantMallGroup.id,
      name: 'Mall of İstanbul',
      slug: 'mall-of-istanbul',
      status: 'LIVE',
    },
  });

  const mallBursa = await prisma.mall.upsert({
    where: { tenantId_slug: { tenantId: tenantMallGroup.id, slug: 'mall-of-bursa' } },
    update: { name: 'Mall of Bursa' },
    create: {
      tenantId: tenantMallGroup.id,
      name: 'Mall of Bursa',
      slug: 'mall-of-bursa',
      status: 'LIVE',
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {
      passwordHash: await bcrypt.hash('SuperAdmin123!', passwordCost),
      isSuperAdmin: true,
      status: 'ACTIVE',
      deletedAt: null,
    },
    create: {
      email: 'superadmin@example.com',
      passwordHash: await bcrypt.hash('SuperAdmin123!', passwordCost),
      firstName: 'Super',
      lastName: 'Admin',
      isSuperAdmin: true,
      status: 'ACTIVE',
    },
  });

  const groupAdmin = await prisma.user.upsert({
    where: { email: 'groupadmin@example.com' },
    update: {
      passwordHash: await bcrypt.hash('GroupAdmin123!', passwordCost),
      isSuperAdmin: false,
      status: 'ACTIVE',
      deletedAt: null,
    },
    create: {
      email: 'groupadmin@example.com',
      passwordHash: await bcrypt.hash('GroupAdmin123!', passwordCost),
      firstName: 'Group',
      lastName: 'Admin',
      isSuperAdmin: false,
      status: 'ACTIVE',
    },
  });

  const mallManager = await prisma.user.upsert({
    where: { email: 'mallmanager@example.com' },
    update: {
      passwordHash: await bcrypt.hash('MallManager123!', passwordCost),
      isSuperAdmin: false,
      status: 'ACTIVE',
      deletedAt: null,
    },
    create: {
      email: 'mallmanager@example.com',
      passwordHash: await bcrypt.hash('MallManager123!', passwordCost),
      firstName: 'Mall',
      lastName: 'Manager',
      isSuperAdmin: false,
      status: 'ACTIVE',
    },
  });

  const groupAdminTu = await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenantMallGroup.id, userId: groupAdmin.id } },
    update: { roleId: roles.TENANT_ADMIN.id, deletedAt: null },
    create: {
      tenantId: tenantMallGroup.id,
      userId: groupAdmin.id,
      roleId: roles.TENANT_ADMIN.id,
    },
  });

  const mallManagerTu = await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenantMallGroup.id, userId: mallManager.id } },
    update: { roleId: roles.MALL_MANAGER.id, deletedAt: null },
    create: {
      tenantId: tenantMallGroup.id,
      userId: mallManager.id,
      roleId: roles.MALL_MANAGER.id,
    },
  });

  await prisma.userMallAccess.deleteMany({ where: { tenantUserId: mallManagerTu.id } });
  await prisma.userMallAccess.create({
    data: { tenantUserId: mallManagerTu.id, mallId: mallIstanbul.id },
  });

  await prisma.userMallAccess.deleteMany({ where: { tenantUserId: groupAdminTu.id } });

  console.log('Seed complete.', {
    tenants: [tenantEmaar.slug, tenantMallGroup.slug],
    malls: [mallEmaar.slug, mallIstanbul.slug, mallBursa.slug],
    users: [superAdmin.email, groupAdmin.email, mallManager.email],
    permissions: PERMISSIONS.length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
