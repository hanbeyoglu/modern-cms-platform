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
  'analytics:export',
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
  'store-category:read',
  'store-category:create',
  'store-category:update',
  'store-category:delete',
  'global-store:read',
  'global-store:create',
  'global-store:update',
  'global-store:delete',
  'mall-store:read',
  'mall-store:assign',
  'mall-store:update',
  'mall-store:delete',
  'mall-store:feature',
  'event:read',
  'event:create',
  'event:update',
  'event:delete',
  'event:publish',
  'event:archive',
  'campaign:read',
  'campaign:create',
  'campaign:update',
  'campaign:delete',
  'campaign:publish',
  'campaign:archive',
  'cinema:read',
  'cinema:create',
  'cinema:update',
  'cinema:delete',
  'movie:read',
  'movie:create',
  'movie:update',
  'movie:delete',
  'movie-session:read',
  'movie-session:create',
  'movie-session:update',
  'movie-session:delete',
  'movie-session:cancel',
  'page:read',
  'page:create',
  'page:update',
  'page:delete',
  'page:publish',
  'page:archive',
  'page-block:read',
  'page-block:create',
  'page-block:update',
  'page-block:delete',
  'page-block:reorder',
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
        'store-category:read',
        'global-store:read',
        'mall-store:read',
        'mall-store:assign',
        'mall-store:update',
        'mall-store:feature',
        'event:read',
        'event:create',
        'event:update',
        'event:delete',
        'event:publish',
        'event:archive',
        'campaign:read',
        'campaign:create',
        'campaign:update',
        'campaign:delete',
        'campaign:publish',
        'campaign:archive',
        'cinema:read',
        'cinema:create',
        'cinema:update',
        'cinema:delete',
        'movie:read',
        'movie:create',
        'movie:update',
        'movie-session:read',
        'movie-session:create',
        'movie-session:update',
        'movie-session:delete',
        'movie-session:cancel',
        'page:read',
        'page:create',
        'page:update',
        'page:publish',
        'page:archive',
        'page-block:read',
        'page-block:create',
        'page-block:update',
        'page-block:delete',
        'page-block:reorder',
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
        'store-category:read',
        'global-store:read',
        'mall-store:read',
        'mall-store:update',
        'event:read',
        'event:create',
        'event:update',
        'campaign:read',
        'campaign:create',
        'campaign:update',
        'cinema:read',
        'cinema:create',
        'cinema:update',
        'movie:read',
        'movie:create',
        'movie:update',
        'movie-session:read',
        'movie-session:create',
        'movie-session:update',
        'page:read',
        'page:create',
        'page:update',
        'page-block:read',
        'page-block:create',
        'page-block:update',
        'page-block:reorder',
      ],
    },
    {
      code: 'REPORT_VIEWER',
      name: 'Report Viewer',
      permissions: [
        'tenant:read',
        'mall:read',
        'analytics:view',
        'analytics:export',
        'media:read',
        'slider:read',
        'store-category:read',
        'global-store:read',
        'mall-store:read',
        'event:read',
        'campaign:read',
        'cinema:read',
        'movie:read',
        'movie-session:read',
        'page:read',
        'page-block:read',
      ],
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

  const catFashion = await prisma.storeCategory.upsert({
    where: { slug: 'fashion' },
    update: { name: 'Moda', deletedAt: null, status: 'ACTIVE' },
    create: {
      name: 'Moda',
      slug: 'fashion',
      icon: null,
      sortOrder: 10,
      status: 'ACTIVE',
    },
  });

  await prisma.storeCategory.upsert({
    where: { slug: 'food-beverage' },
    update: { name: 'Yeme-İçme', deletedAt: null, status: 'ACTIVE' },
    create: {
      name: 'Yeme-İçme',
      slug: 'food-beverage',
      sortOrder: 20,
      status: 'ACTIVE',
    },
  });

  const globalZara = await prisma.globalStore.upsert({
    where: { slug: 'zara' },
    update: {
      name: 'Zara',
      categoryId: catFashion.id,
      deletedAt: null,
      status: 'ACTIVE',
      updatedBy: superAdmin.id,
    },
    create: {
      name: 'Zara',
      slug: 'zara',
      categoryId: catFashion.id,
      description: 'Global mağaza havuzu — Zara',
      websiteUrl: 'https://www.zara.com',
      status: 'ACTIVE',
      createdBy: superAdmin.id,
    },
  });

  const zaraAtIstanbul = await prisma.mallStore.findFirst({
    where: { mallId: mallIstanbul.id, globalStoreId: globalZara.id, deletedAt: null },
  });
  if (!zaraAtIstanbul) {
    await prisma.mallStore.create({
      data: {
        tenantId: tenantMallGroup.id,
        mallId: mallIstanbul.id,
        globalStoreId: globalZara.id,
        localName: 'Zara — Mall of İstanbul',
        floor: '2',
        storeNo: '230',
        phone: '+90 212 555 0000',
        status: 'ACTIVE',
        sortOrder: 5,
        createdBy: superAdmin.id,
      },
    });
  }

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
