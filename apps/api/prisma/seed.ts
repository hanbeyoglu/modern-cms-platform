import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { OFFICIAL_SUPPORTED_LANGUAGES } from '../src/locales/supported-languages';
import { slugify } from '../src/common/utils/slugify';
import { DEFAULT_MOVIE_CATEGORIES } from '../src/movies/movie-categories.constants';

const prisma = new PrismaClient();

type CapCat =
  | 'CORE'
  | 'CONTENT'
  | 'OPERATIONS'
  | 'ANALYTICS'
  | 'LOCALIZATION'
  | 'PUBLIC_DELIVERY'
  | 'SEARCH'
  | 'CDP'
  | 'AI'
  | 'INTEGRATION';

const CAPABILITIES: Array<{
  code: string;
  name: string;
  description: string;
  category: CapCat;
}> = [
  // CORE
  { code: 'cms_core', name: 'CMS Core', description: 'Temel CMS işlevleri', category: 'CORE' },
  { code: 'media', name: 'Medya Kütüphanesi', description: 'Medya yönetimi', category: 'CORE' },
  {
    code: 'public_api',
    name: 'Public API',
    description: "Halka açık içerik API'si",
    category: 'PUBLIC_DELIVERY',
  },
  // CONTENT
  {
    code: 'sliders',
    name: 'Slider Yönetimi',
    description: 'Slider ve banner yönetimi',
    category: 'CONTENT',
  },
  {
    code: 'pages',
    name: 'Sayfa Oluşturucu',
    description: 'Dinamik sayfa oluşturucu',
    category: 'CONTENT',
  },
  {
    code: 'stores',
    name: 'Mağaza Yönetimi',
    description: 'Mağaza ve kategori yönetimi',
    category: 'CONTENT',
  },
  { code: 'events', name: 'Etkinlikler', description: 'Etkinlik yönetimi', category: 'CONTENT' },
  { code: 'campaigns', name: 'Kampanyalar', description: 'Kampanya yönetimi', category: 'CONTENT' },
  { code: 'cinema', name: 'Sinema', description: 'Sinema ve film yönetimi', category: 'CONTENT' },
  {
    code: 'popups',
    name: 'Popup Yönetimi',
    description: 'Popup ve duyuru yönetimi',
    category: 'CONTENT',
  },
  {
    code: 'location_services',
    name: 'Lokasyon Hizmetleri',
    description: 'WC, ATM, vale gibi lokasyon hizmetleri',
    category: 'CONTENT',
  },
  // OPERATIONS
  {
    code: 'scheduling',
    name: 'Zamanlama',
    description: 'İçerik zamanlama ve otomasyonu',
    category: 'OPERATIONS',
  },
  {
    code: 'notifications',
    name: 'Bildirimler',
    description: 'In-app bildirim sistemi',
    category: 'OPERATIONS',
  },
  // ANALYTICS
  {
    code: 'analytics',
    name: 'Analitik & Raporlar',
    description: 'İçerik ve kullanıcı analitikleri',
    category: 'ANALYTICS',
  },
  // LOCALIZATION
  {
    code: 'localization',
    name: 'Çoklu Dil',
    description: 'İçerik lokalizasyonu ve çeviri yönetimi',
    category: 'LOCALIZATION',
  },
  // SEARCH
  {
    code: 'search',
    name: 'Genel Arama',
    description: 'Full-text içerik araması',
    category: 'SEARCH',
  },
  // CDP (future — not enabled by default)
  {
    code: 'cdp_basic',
    name: 'CDP Temel',
    description: 'Temel müşteri veri platformu',
    category: 'CDP',
  },
  {
    code: 'cdp_advanced',
    name: 'CDP Gelişmiş',
    description: 'Gelişmiş müşteri segmentasyonu',
    category: 'CDP',
  },
  {
    code: 'segments',
    name: 'Segmentler',
    description: 'Müşteri segment yönetimi',
    category: 'CDP',
  },
  {
    code: 'journeys',
    name: 'Müşteri Yolculukları',
    description: 'Otomatik müşteri yolculukları',
    category: 'CDP',
  },
  {
    code: 'personalization',
    name: 'Kişiselleştirme',
    description: 'İçerik kişiselleştirme motoru',
    category: 'CDP',
  },
  // AI (future)
  {
    code: 'ai_assistant',
    name: 'AI Asistan',
    description: 'AI destekli içerik önerileri',
    category: 'AI',
  },
  // INTEGRATIONS (future)
  {
    code: 'external_cinema_provider',
    name: 'Harici Sinema Sağlayıcı',
    description: 'Sinema API/XML feed entegrasyonu',
    category: 'INTEGRATION',
  },
  {
    code: 'signage',
    name: 'Dijital Tabela',
    description: 'Dijital tabela entegrasyonu',
    category: 'INTEGRATION',
  },
  {
    code: 'mobile_app_api',
    name: 'Mobil Uygulama API',
    description: 'Mobil uygulama API erişimi',
    category: 'INTEGRATION',
  },
];

// Capabilities enabled for all demo tenants
const DEMO_TENANT_CAPABILITIES = [
  'cms_core',
  'media',
  'public_api',
  'sliders',
  'pages',
  'stores',
  'events',
  'campaigns',
  'cinema',
  'popups',
  'location_services',
  'scheduling',
  'notifications',
  'analytics',
  'localization',
  'search',
];

const PERMISSIONS = [
  'tenant:read',
  'tenant:create',
  'tenant:update',
  'tenant:delete',
  'mall:read',
  'mall:switch',
  'location:read',
  'location:create',
  'location:update',
  'location:delete',
  'user:read',
  'user:create',
  'user:update',
  'user:delete',
  'role:read',
  'role:create',
  'role:update',
  'role:delete',
  'settings:read',
  'settings:update',
  'analytics:view',
  'analytics:export',
  'content:read',
  'content:create',
  'content:update',
  'content:publish',
  'media:read',
  'media:upload',
  'media:update',
  'media:delete',
  'media:manage-folders',
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
  'locale:read',
  'locale:create',
  'locale:update',
  'locale:delete',
  'locale:set-default',
  'system-language:read',
  'system-language:create',
  'system-language:update',
  'system-language:delete',
  'translation:read',
  'translation:create',
  'translation:update',
  'translation:delete',
  'notification:read',
  'notification:update',
  'notification:delete',
  'search:global',
  'audit:read',
  'audit:security',
  'audit:export',
  'popup:read',
  'popup:create',
  'popup:update',
  'popup:delete',
  'popup:publish',
  'service:read',
  'service:create',
  'service:update',
  'service:delete',
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
  const permByCode = Object.fromEntries(
    permissionRows.map((p) => [p.code, p]),
  ) as unknown as Record<(typeof PERMISSIONS)[number], { id: string }>;

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
    // audit permissions are included in PERMISSIONS — SUPER_ADMIN gets all
    {
      code: 'TENANT_ADMIN',
      name: 'Tenant Admin',
      permissions: PERMISSIONS.filter(
        (p) =>
          // Tenant Admin cannot: create/delete tenants, use security/export audit,
          // mutate global store master data, manage system languages, or legacy locale mutations.
          ![
            'tenant:create',
            'tenant:delete',
            'audit:security',
            'audit:export',
            'global-store:create',
            'global-store:update',
            'global-store:delete',
            'locale:create',
            'locale:update',
            'locale:delete',
            'locale:set-default',
            'system-language:read',
            'system-language:create',
            'system-language:update',
            'system-language:delete',
          ].includes(p),
      ),
    },
    {
      code: 'MALL_MANAGER',
      name: 'Mall Manager',
      permissions: [
        'mall:read',
        'mall:switch',
        'location:read',
        'location:update',
        'analytics:view',
        'search:global',
        'content:read',
        'content:create',
        'content:update',
        'content:publish',
        'media:read',
        'media:upload',
        'media:update',
        'media:delete',
        'media:manage-folders',
        'slider:read',
        'slider:create',
        'slider:update',
        'slider:delete',
        'slider:publish',
        'slider:reorder',
        'mall-store:read',
        'mall-store:assign',
        'mall-store:update',
        'mall-store:feature',
        'store-category:read',
        'store-category:create',
        'store-category:update',
        'store-category:delete',
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
        'locale:read',
        'translation:read',
        'translation:create',
        'translation:update',
        'notification:read',
        'notification:update',
        'popup:read',
        'popup:create',
        'popup:update',
        'popup:delete',
        'popup:publish',
        'service:read',
        'service:create',
        'service:update',
        'service:delete',
      ],
    },
    {
      code: 'CONTENT_EDITOR',
      name: 'Content Editor',
      permissions: [
        'mall:read',
        'mall:switch',
        'location:read',
        'user:read',
        'content:read',
        'search:global',
        'content:create',
        'content:update',
        'media:read',
        'media:upload',
        'media:update',
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
        'locale:read',
        'translation:read',
        'translation:create',
        'translation:update',
        'notification:read',
        'notification:update',
        'popup:read',
        'popup:create',
        'popup:update',
        'service:read',
        'service:create',
        'service:update',
      ],
    },
    {
      code: 'REPORT_VIEWER',
      name: 'Report Viewer',
      permissions: [
        'tenant:read',
        'mall:read',
        'location:read',
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
        'search:global',
        'notification:read',
        'notification:update',
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

  for (const tenant of [tenantEmaar, tenantMallGroup]) {
    await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'movieProviders' } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: 'movieProviders',
        value: {
          tmdb: {
            readAccessToken: '',
            language: 'tr-TR',
            region: 'TR',
            posterSize: 'w500',
            syncEnabled: true,
            cronTime: '03:00',
          },
        },
      },
    });

    for (const [index, name] of DEFAULT_MOVIE_CATEGORIES.entries()) {
      await prisma.movieCategory.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: slugify(name) } },
        update: { name, sortOrder: (index + 1) * 10 },
        create: {
          tenantId: tenant.id,
          name,
          slug: slugify(name),
          sortOrder: (index + 1) * 10,
        },
      });
    }
  }

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
    where: { mallId_normalizedName: { mallId: mallIstanbul.id, normalizedName: 'moda' } },
    update: { name: 'Moda', deletedAt: null, active: true },
    create: {
      tenantId: tenantMallGroup.id,
      mallId: mallIstanbul.id,
      name: 'Moda',
      normalizedName: 'moda',
      slug: 'moda',
      slugAutoGenerated: true,
      sortOrder: 10,
      active: true,
    },
  });

  await prisma.storeCategory.upsert({
    where: { mallId_normalizedName: { mallId: mallIstanbul.id, normalizedName: 'yeme-icme' } },
    update: { name: 'Yeme-İçme', deletedAt: null, active: true },
    create: {
      tenantId: tenantMallGroup.id,
      mallId: mallIstanbul.id,
      name: 'Yeme-İçme',
      normalizedName: 'yeme-icme',
      slug: 'yeme-icme',
      slugAutoGenerated: true,
      sortOrder: 20,
      active: true,
    },
  });

  const globalZara = await prisma.globalStore.upsert({
    where: { slug: 'zara' },
    update: {
      name: 'Zara',
      normalizedName: 'zara',
      deletedAt: null,
      status: 'ACTIVE',
      updatedBy: superAdmin.id,
    },
    create: {
      name: 'Zara',
      normalizedName: 'zara',
      slug: 'zara',
      slugAutoGenerated: true,
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
        categoryId: catFashion.id,
        detailTitle: 'Zara — Mall of İstanbul',
        floor: '2',
        storeNo: '230',
        phone: '+90 212 555 0000',
        status: 'ACTIVE',
        sortOrder: 5,
        searchTags: [],
        isSoon: false,
        createdBy: superAdmin.id,
      },
    });
  }

  // ─── Capabilities ─────────────────────────────────────────────────────────────
  const capRows = await Promise.all(
    CAPABILITIES.map((cap) =>
      prisma.capability.upsert({
        where: { code: cap.code },
        update: { name: cap.name, description: cap.description, category: cap.category },
        create: {
          code: cap.code,
          name: cap.name,
          description: cap.description,
          category: cap.category,
          isSystem: true,
        },
      }),
    ),
  );
  const capByCode = Object.fromEntries(capRows.map((c) => [c.code, c]));

  // Enable current capabilities for demo tenants
  const now = new Date();
  for (const tenant of [tenantEmaar, tenantMallGroup]) {
    for (const code of DEMO_TENANT_CAPABILITIES) {
      const cap = capByCode[code];
      if (!cap) continue;
      await prisma.tenantCapability.upsert({
        where: { tenantId_capabilityId: { tenantId: tenant.id, capabilityId: cap.id } },
        update: { enabled: true, enabledAt: now },
        create: { tenantId: tenant.id, capabilityId: cap.id, enabled: true, enabledAt: now },
      });
    }
  }

  // ─── Permissions — add capability permissions ─────────────────────────────────
  const capabilityPerms = ['capability:read', 'capability:update'] as const;
  const capabilityPermRows = await Promise.all(
    capabilityPerms.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      }),
    ),
  );
  const capPermByCode = Object.fromEntries(capabilityPermRows.map((p) => [p.code, p]));

  // SUPER_ADMIN and TENANT_ADMIN get capability:read; only SUPER_ADMIN gets capability:update
  const superAdminRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
  const tenantAdminRole = await prisma.role.findUnique({ where: { code: 'TENANT_ADMIN' } });

  if (superAdminRole) {
    for (const code of capabilityPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: superAdminRole.id, permissionId: capPermByCode[code].id },
        },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: capPermByCode[code].id },
      });
    }
  }
  if (tenantAdminRole) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: tenantAdminRole.id,
          permissionId: capPermByCode['capability:read'].id,
        },
      },
      update: {},
      create: { roleId: tenantAdminRole.id, permissionId: capPermByCode['capability:read'].id },
    });
  }

  // ─── Tenant media dimension guidelines (defaults per usage context) ─────────
  const MEDIA_GUIDELINE_DEFAULTS: Array<{
    usageKey: string;
    recommendedWidth: number;
    recommendedHeight: number;
    acceptedMimeTypes: string[];
    helperText: string | null;
    aspectRatioLocked: boolean;
  }> = [
    {
      usageKey: 'HOMEPAGE_HERO',
      recommendedWidth: 1920,
      recommendedHeight: 800,
      acceptedMimeTypes: ['image/*'],
      helperText: 'Ana sayfa üst banner görseli',
      aspectRatioLocked: true,
    },
    {
      usageKey: 'SLIDER_DESKTOP',
      recommendedWidth: 1920,
      recommendedHeight: 720,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'SLIDER_MOBILE',
      recommendedWidth: 768,
      recommendedHeight: 1024,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'SLIDER_KIOSK',
      recommendedWidth: 1080,
      recommendedHeight: 1920,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'EVENT_COVER',
      recommendedWidth: 1200,
      recommendedHeight: 630,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'CAMPAIGN_COVER',
      recommendedWidth: 1200,
      recommendedHeight: 630,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'CAMPAIGN_MOBILE_COVER',
      recommendedWidth: 768,
      recommendedHeight: 1024,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'POPUP_IMAGE',
      recommendedWidth: 800,
      recommendedHeight: 800,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'MOVIE_POSTER',
      recommendedWidth: 600,
      recommendedHeight: 900,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'STORE_LOGO',
      recommendedWidth: 512,
      recommendedHeight: 512,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: true,
    },
    {
      usageKey: 'LOCATION_LOGO',
      recommendedWidth: 512,
      recommendedHeight: 512,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: true,
    },
    {
      usageKey: 'LOCATION_COVER',
      recommendedWidth: 1600,
      recommendedHeight: 600,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
    {
      usageKey: 'SERVICE_ICON',
      recommendedWidth: 256,
      recommendedHeight: 256,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: true,
    },
    {
      usageKey: 'SERVICE_COVER',
      recommendedWidth: 1200,
      recommendedHeight: 630,
      acceptedMimeTypes: ['image/*'],
      helperText: null,
      aspectRatioLocked: false,
    },
  ];
  for (const tenant of [tenantEmaar, tenantMallGroup]) {
    for (const g of MEDIA_GUIDELINE_DEFAULTS) {
      await prisma.tenantMediaGuideline.upsert({
        where: { tenantId_usageKey: { tenantId: tenant.id, usageKey: g.usageKey } },
        update: {},
        create: { tenantId: tenant.id, ...g, active: true },
      });
    }
  }

  // ─── Official locale catalog per demo tenant (Sprint 21) ───────────────────
  for (const tenant of [tenantEmaar, tenantMallGroup]) {
    for (let i = 0; i < OFFICIAL_SUPPORTED_LANGUAGES.length; i++) {
      const row = OFFICIAL_SUPPORTED_LANGUAGES[i]!;
      const isActive = row.code === 'tr' || row.code === 'en';
      const isDefault = row.code === 'tr';
      await prisma.locale.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
        update: {
          name: row.name,
          nativeName: row.nativeName,
          rtl: row.rtl,
          sortOrder: i,
          isDefault,
          isActive,
        },
        create: {
          tenantId: tenant.id,
          code: row.code,
          name: row.name,
          nativeName: row.nativeName,
          isDefault,
          isActive,
          rtl: row.rtl,
          sortOrder: i,
        },
      });
    }
  }

  console.log('Seed complete.', {
    tenants: [tenantEmaar.slug, tenantMallGroup.slug],
    malls: [mallEmaar.slug, mallIstanbul.slug, mallBursa.slug],
    users: [superAdmin.email, groupAdmin.email, mallManager.email],
    permissions: PERMISSIONS.length + capabilityPerms.length,
    capabilities: CAPABILITIES.length,
    demoEnabledCapabilities: DEMO_TENANT_CAPABILITIES.length,
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
