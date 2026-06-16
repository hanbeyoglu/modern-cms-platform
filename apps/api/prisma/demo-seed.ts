import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type DemoMall = {
  tenantId: string;
  mallId: string;
  mallSlug: string;
  mallName: string;
};

const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function upsertMedia(
  demo: DemoMall,
  uploadedBy: string,
  key: string,
  name: string,
  usageContext: string,
  color: string,
) {
  return prisma.mediaAsset.upsert({
    where: { storageKey: `demo/${demo.mallSlug}/${key}.jpg` },
    update: {
      tenantId: demo.tenantId,
      mallId: demo.mallId,
      originalName: name,
      altText: name,
      usageContext,
      dominantColor: color,
      deletedAt: null,
      status: 'ACTIVE',
    },
    create: {
      tenantId: demo.tenantId,
      mallId: demo.mallId,
      uploadedBy,
      originalName: name,
      fileName: `${key}.jpg`,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      size: 384000,
      width: 1600,
      height: 900,
      storageKey: `demo/${demo.mallSlug}/${key}.jpg`,
      publicUrl: `https://placehold.co/1600x900/${color.replace('#', '')}/ffffff.jpg?text=${encodeURIComponent(name)}`,
      altText: name,
      caption: name,
      tags: ['demo', demo.mallSlug, usageContext.toLowerCase()],
      usageContext,
      dominantColor: color,
      source: 'demo-seed',
      status: 'ACTIVE',
    },
  });
}

async function upsertCategory(name: string, sortOrder: number, icon: string) {
  return prisma.storeCategory.upsert({
    where: { slug: slugify(name) },
    update: { name, sortOrder, icon, status: 'ACTIVE', deletedAt: null },
    create: { name, slug: slugify(name), sortOrder, icon, status: 'ACTIVE' },
  });
}

async function upsertGlobalStore(
  name: string,
  categoryId: string,
  createdBy: string,
  description: string,
) {
  return prisma.globalStore.upsert({
    where: { slug: slugify(name) },
    update: {
      name,
      categoryId,
      description,
      websiteUrl: `https://www.${slugify(name)}.example.com`,
      status: 'ACTIVE',
      deletedAt: null,
      updatedBy: createdBy,
    },
    create: {
      name,
      slug: slugify(name),
      categoryId,
      description,
      websiteUrl: `https://www.${slugify(name)}.example.com`,
      status: 'ACTIVE',
      createdBy,
    },
  });
}

async function upsertMallStore(
  demo: DemoMall,
  globalStoreId: string,
  categoryId: string,
  createdBy: string,
  index: number,
) {
  const existing = await prisma.mallStore.findFirst({
    where: { mallId: demo.mallId, globalStoreId, deletedAt: null },
  });
  const data = {
    tenantId: demo.tenantId,
    mallId: demo.mallId,
    globalStoreId,
    floor: String((index % 3) + 1),
    storeNo: `${100 + index}`,
    phone: `+90 212 555 ${String(index).padStart(4, '0')}`,
    workingHoursJson: { weekdays: '10:00-22:00', weekend: '10:00-23:00' },
    locationJson: { zone: ['North', 'Atrium', 'Garden'][index % 3], gate: `G${(index % 4) + 1}` },
    isFeatured: index < 4,
    sortOrder: index * 10,
    status: 'ACTIVE' as const,
    isSoon: false,
    searchTags: ['demo', demo.mallSlug],
    updatedBy: createdBy,
  };
  const mallStore = existing
    ? await prisma.mallStore.update({ where: { id: existing.id }, data })
    : await prisma.mallStore.create({ data: { ...data, createdBy } });

  await prisma.mallStoreOnCategory.upsert({
    where: { mallStoreId_storeCategoryId: { mallStoreId: mallStore.id, storeCategoryId: categoryId } },
    update: {},
    create: { mallStoreId: mallStore.id, storeCategoryId: categoryId },
  });
  return mallStore;
}

async function seedMall(demo: DemoMall, createdBy: string) {
  const hero = await upsertMedia(demo, createdBy, 'hero-summer', `${demo.mallName} Yaz Sahnesi`, 'SLIDER_DESKTOP', '#1d4ed8');
  const campaignCover = await upsertMedia(demo, createdBy, 'campaign-style', `${demo.mallName} Sezon Kampanyası`, 'CAMPAIGN_COVER', '#be123c');
  const eventCover = await upsertMedia(demo, createdBy, 'event-live', `${demo.mallName} Etkinlik Görseli`, 'EVENT_COVER', '#047857');
  const popupImage = await upsertMedia(demo, createdBy, 'popup-app', `${demo.mallName} Mobil Uygulama`, 'POPUP_IMAGE', '#7c3aed');
  const serviceIcon = await upsertMedia(demo, createdBy, 'service-concierge', `${demo.mallName} Danışma İkonu`, 'SERVICE_ICON', '#0f766e');

  const brands = await prisma.globalStore.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    include: { category: true },
    orderBy: { name: 'asc' },
    take: 14,
  });
  const mallStores = [];
  for (let index = 0; index < brands.length; index++) {
    const brand = brands[index]!;
    mallStores.push(
      await upsertMallStore(
        demo,
        brand.id,
        brand.categoryId ?? brand.category?.id ?? (await upsertCategory('Lifestyle', 90, 'sparkles')).id,
        createdBy,
        index + 1,
      ),
    );
  }

  const campaignRows = [
    ['Hafta Sonu Stil Festivali', 'Seçili moda markalarında hafta sonuna özel fırsatlar.', -3, 14],
    ['Yeme İçme Lezzet Rotası', 'Restoranlarda menü eşleşmeleri ve aile paketleri.', -1, 20],
    ['Okula Dönüş Alışveriş Günleri', 'Kırtasiye, teknoloji ve çocuk mağazalarında yaklaşan kampanya.', 9, 25],
  ] as const;
  for (let index = 0; index < campaignRows.length; index++) {
    const [title, description, startOffset, endOffset] = campaignRows[index]!;
    await prisma.campaign.upsert({
      where: { tenantId_slug: { tenantId: demo.tenantId, slug: `${demo.mallSlug}-${slugify(title)}` } },
      update: {
        mallId: demo.mallId,
        storeId: mallStores[index]?.id ?? null,
        title,
        shortDescription: description,
        description,
        coverMediaId: campaignCover.id,
        startAt: daysFromNow(startOffset),
        endAt: daysFromNow(endOffset),
        status: startOffset > 0 ? 'SCHEDULED' : 'PUBLISHED',
        publishedAt: startOffset > 0 ? null : daysFromNow(-3),
        updatedBy: createdBy,
        deletedAt: null,
      },
      create: {
        tenantId: demo.tenantId,
        mallId: demo.mallId,
        storeId: mallStores[index]?.id ?? null,
        title,
        slug: `${demo.mallSlug}-${slugify(title)}`,
        shortDescription: description,
        description,
        coverMediaId: campaignCover.id,
        startAt: daysFromNow(startOffset),
        endAt: daysFromNow(endOffset),
        terms: 'Demo koşulları mağazaya göre değişebilir.',
        buttonText: 'Detayları Gör',
        linkUrl: '/campaigns',
        status: startOffset > 0 ? 'SCHEDULED' : 'PUBLISHED',
        sortOrder: index * 10,
        channels: ['WEB', 'MOBILE'],
        publishedAt: startOffset > 0 ? null : daysFromNow(-3),
        createdBy,
      },
    });
  }

  const eventRows = [
    ['Cuma Akşamı Canlı Müzik', 'Ana atriumda canlı performans.', 2, 2],
    ['Çocuk Atölyesi', 'Hafta sonu çocuklara özel yaratıcı atölyeler.', 5, 5],
    ['Yeni Sezon Stil Sohbeti', 'Influencer konuklarla trend buluşması.', 12, 12],
  ] as const;
  for (let index = 0; index < eventRows.length; index++) {
    const [title, description, startOffset, endOffset] = eventRows[index]!;
    await prisma.event.upsert({
      where: { tenantId_slug: { tenantId: demo.tenantId, slug: `${demo.mallSlug}-${slugify(title)}` } },
      update: {
        mallId: demo.mallId,
        title,
        shortDescription: description,
        description,
        coverMediaId: eventCover.id,
        startAt: daysFromNow(startOffset),
        endAt: daysFromNow(endOffset),
        status: 'PUBLISHED',
        publishedAt: daysFromNow(-2),
        updatedBy: createdBy,
        deletedAt: null,
      },
      create: {
        tenantId: demo.tenantId,
        mallId: demo.mallId,
        title,
        slug: `${demo.mallSlug}-${slugify(title)}`,
        shortDescription: description,
        description,
        coverMediaId: eventCover.id,
        startAt: daysFromNow(startOffset),
        endAt: daysFromNow(endOffset),
        location: 'Ana Atrium',
        category: 'Lifestyle',
        buttonText: 'Programa Git',
        linkUrl: '/events',
        status: 'PUBLISHED',
        sortOrder: index * 10,
        channels: ['WEB', 'MOBILE', 'KIOSK'],
        publishedAt: daysFromNow(-2),
        createdBy,
      },
    });
  }

  const slider = await prisma.slider.upsert({
    where: { id: `demo-slider-${demo.mallSlug}` },
    update: {
      tenantId: demo.tenantId,
      mallId: demo.mallId,
      title: `${demo.mallName} Ana Sayfa Hero`,
      placementType: 'HOME',
      status: 'PUBLISHED',
      startAt: daysFromNow(-5),
      endAt: daysFromNow(30),
      channels: ['WEB', 'MOBILE'],
      updatedBy: createdBy,
      deletedAt: null,
    },
    create: {
      id: `demo-slider-${demo.mallSlug}`,
      tenantId: demo.tenantId,
      mallId: demo.mallId,
      title: `${demo.mallName} Ana Sayfa Hero`,
      placementType: 'HOME',
      status: 'PUBLISHED',
      startAt: daysFromNow(-5),
      endAt: daysFromNow(30),
      channels: ['WEB', 'MOBILE'],
      sortOrder: 10,
      createdBy,
    },
  });
  await prisma.sliderItem.upsert({
    where: { id: `demo-slider-item-${demo.mallSlug}-summer` },
    update: {
      desktopMediaId: hero.id,
      mobileMediaId: hero.id,
      title: 'Yazı Şehirde Yakala',
      description: 'Yeni sezon vitrinleri, etkinlikler ve kampanyalar yayında.',
      buttonText: 'Keşfet',
      linkUrl: '/campaigns',
      sortOrder: 10,
      status: 'PUBLISHED',
      deletedAt: null,
    },
    create: {
      id: `demo-slider-item-${demo.mallSlug}-summer`,
      sliderId: slider.id,
      desktopMediaId: hero.id,
      mobileMediaId: hero.id,
      title: 'Yazı Şehirde Yakala',
      description: 'Yeni sezon vitrinleri, etkinlikler ve kampanyalar yayında.',
      buttonText: 'Keşfet',
      linkUrl: '/campaigns',
      sortOrder: 10,
      status: 'PUBLISHED',
    },
  });

  await prisma.popup.upsert({
    where: { id: `demo-popup-${demo.mallSlug}-app` },
    update: {
      tenantId: demo.tenantId,
      mallId: demo.mallId,
      title: 'Mobil Uygulamada Yeni Ayrıcalıklar',
      description: 'QR kuponlar ve anlık etkinlik hatırlatmaları demo akışında hazır.',
      imageMediaId: popupImage.id,
      status: 'PUBLISHED',
      startAt: daysFromNow(-2),
      endAt: daysFromNow(18),
      updatedBy: createdBy,
      deletedAt: null,
    },
    create: {
      id: `demo-popup-${demo.mallSlug}-app`,
      tenantId: demo.tenantId,
      mallId: demo.mallId,
      title: 'Mobil Uygulamada Yeni Ayrıcalıklar',
      description: 'QR kuponlar ve anlık etkinlik hatırlatmaları demo akışında hazır.',
      imageMediaId: popupImage.id,
      linkUrl: '/campaigns',
      buttonText: 'Fırsatları Aç',
      status: 'PUBLISHED',
      channels: ['WEB', 'MOBILE'],
      startAt: daysFromNow(-2),
      endAt: daysFromNow(18),
      sortOrder: 10,
      showOnce: true,
      closable: true,
      publishedAt: daysFromNow(-2),
      createdBy,
    },
  });

  const serviceRows = [
    ['Danışma', 'Concierge', 'Zemin Kat', 'Ana giriş karşısı'],
    ['Vale', 'Otopark', 'P1', 'Batı kapısı'],
    ['Bebek Bakım Odası', 'Aile', '1', 'Food court yanı'],
  ] as const;
  for (let index = 0; index < serviceRows.length; index++) {
    const [name, category, floor, locationLabel] = serviceRows[index]!;
    const existing = await prisma.service.findFirst({
      where: { tenantId: demo.tenantId, mallId: demo.mallId, name, deletedAt: null },
    });
    const data = {
      tenantId: demo.tenantId,
      mallId: demo.mallId,
      name,
      description: `${demo.mallName} ziyaretçileri için ${name.toLocaleLowerCase('tr-TR')} hizmeti.`,
      iconMediaId: serviceIcon.id,
      category,
      floor,
      locationLabel,
      searchTags: ['demo', category.toLocaleLowerCase('tr-TR')],
      status: 'ACTIVE' as const,
      sortOrder: index * 10,
      updatedBy: createdBy,
      deletedAt: null,
    };
    if (existing) await prisma.service.update({ where: { id: existing.id }, data });
    else await prisma.service.create({ data: { ...data, createdBy } });
  }

  const pages = [
    ['Ulaşım', 'TRANSPORTATION', 'Metro, otobüs, otopark ve vale bilgileri tek sayfada.'],
    ['Ziyaretçi Hizmetleri', 'FAQ', 'Sık sorular, aile hizmetleri ve danışma yönlendirmeleri.'],
  ] as const;
  for (const [title, type, html] of pages) {
    await prisma.page.upsert({
      where: { tenantId_slug: { tenantId: demo.tenantId, slug: `${demo.mallSlug}-${slugify(title)}` } },
      update: {
        mallId: demo.mallId,
        title,
        type,
        status: 'PUBLISHED',
        contentHtml: `<p>${html}</p>`,
        publishedAt: daysFromNow(-4),
        updatedBy: createdBy,
        deletedAt: null,
      },
      create: {
        tenantId: demo.tenantId,
        mallId: demo.mallId,
        title,
        slug: `${demo.mallSlug}-${slugify(title)}`,
        type,
        status: 'PUBLISHED',
        seoTitle: `${demo.mallName} ${title}`,
        seoDescription: html,
        contentHtml: `<p>${html}</p>`,
        publishedAt: daysFromNow(-4),
        createdBy,
      },
    });
  }
}

async function main(): Promise<void> {
  const creator =
    (await prisma.user.findUnique({ where: { email: 'superadmin@example.com' } })) ??
    (await prisma.user.findFirst({ where: { status: 'ACTIVE', deletedAt: null }, orderBy: { createdAt: 'asc' } }));

  if (!creator) {
    throw new Error('No active user found. Run `pnpm db:seed` before `pnpm demo:seed`.');
  }

  const categories = [
    await upsertCategory('Moda', 10, 'shirt'),
    await upsertCategory('Yeme İçme', 20, 'utensils'),
    await upsertCategory('Teknoloji', 30, 'smartphone'),
    await upsertCategory('Kozmetik', 40, 'sparkles'),
    await upsertCategory('Ev & Yaşam', 50, 'sofa'),
  ];

  const storeDefs = [
    ['Zara', 0, 'Yeni sezon moda ve aksesuar koleksiyonları.'],
    ['Mango', 0, 'Kadın giyim, aksesuar ve modern şehir stili.'],
    ['Nike', 0, 'Spor giyim, sneaker ve performans ürünleri.'],
    ['Decathlon', 0, 'Spor ekipmanları ve outdoor ürünleri.'],
    ['Starbucks', 1, 'Kahve, tatlı ve hızlı mola deneyimi.'],
    ['BigChefs', 1, 'Aile ve arkadaş buluşmaları için restoran.'],
    ['Apple Premium Partner', 2, 'Teknoloji, servis ve aksesuar deneyimi.'],
    ['MediaMarkt', 2, 'Elektronik, beyaz eşya ve aksesuarlar.'],
    ['Sephora', 3, 'Kozmetik, parfüm ve bakım ürünleri.'],
    ['Gratis', 3, 'Kişisel bakım ve günlük kozmetik ihtiyaçları.'],
    ['IKEA Planning Studio', 4, 'Ev dekorasyonu ve planlama çözümleri.'],
    ['English Home', 4, 'Ev tekstili ve dekoratif ürünler.'],
  ] as const;

  for (const [name, categoryIndex, description] of storeDefs) {
    await upsertGlobalStore(name, categories[categoryIndex]!.id, creator.id, description);
  }

  const malls = await prisma.mall.findMany({
    where: {
      deletedAt: null,
      OR: [
        { slug: 'emaar-avm' },
        { slug: 'mall-of-istanbul' },
        { slug: 'mall-of-bursa' },
      ],
    },
    include: { tenant: true },
    orderBy: { slug: 'asc' },
  });

  if (malls.length === 0) {
    throw new Error('No demo malls found. Run `pnpm db:seed` before `pnpm demo:seed`.');
  }

  for (const mall of malls) {
    await seedMall(
      {
        tenantId: mall.tenantId,
        mallId: mall.id,
        mallSlug: mall.slug,
        mallName: mall.displayName ?? mall.name,
      },
      creator.id,
    );
  }

  console.log('Demo seed complete.', {
    malls: malls.map((mall) => mall.slug),
    stores: storeDefs.length,
    categories: categories.length,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
