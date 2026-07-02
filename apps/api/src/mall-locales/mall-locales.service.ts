import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Locale, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { UpdateLocationLocalesDto } from './dto/update-location-locales.dto';

export type LocationLocaleRow = Locale & {
  /** Active for this specific location (MallLocale.isActive, or implicit for default). */
  locationActive: boolean;
};

@Injectable()
export class MallLocalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async assertMall(tenantId: string, mallId: string) {
    const mall = await this.prisma.mall.findFirst({
      where: { id: mallId, tenantId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!mall) throw new NotFoundException('Lokasyon bulunamadı');
    return mall;
  }

  /**
   * Read-only: system-active locales with per-location activation.
   * Missing MallLocale → locationActive=false (default locale is always active).
   */
  async listForLocation(tenantId: string, mallId: string): Promise<LocationLocaleRow[]> {
    const mall = await this.assertMall(tenantId, mallId);

    const [systemLocales, mallLocales] = await Promise.all([
      this.prisma.locale.findMany({
        where: { tenantId: mall.tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { isDefault: 'desc' }, { code: 'asc' }],
      }),
      this.prisma.mallLocale.findMany({
        where: { mallId, tenantId: mall.tenantId },
        select: { localeId: true, isActive: true },
      }),
    ]);

    const mallMap = new Map(mallLocales.map((r) => [r.localeId, r.isActive] as const));
    const defaultLocale = systemLocales.find((l) => l.isDefault);

    return systemLocales.map((locale) => ({
      ...locale,
      locationActive: this.resolveLocationActive(locale, defaultLocale, mallMap.get(locale.id)),
    }));
  }

  /** Read-only: locales active at both system and location level. */
  async getActiveLocalesForMall(tenantId: string, mallId?: string | null): Promise<Locale[]> {
    if (mallId) {
      const mall = await this.assertMall(tenantId, mallId);
      tenantId = mall.tenantId;
    }

    const systemLocales = await this.prisma.locale.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    if (!mallId || systemLocales.length === 0) return systemLocales;

    const mallLocales = await this.prisma.mallLocale.findMany({
      where: { mallId, tenantId },
      select: { localeId: true, isActive: true },
    });
    const mallMap = new Map(mallLocales.map((r) => [r.localeId, r.isActive] as const));
    const defaultLocale = systemLocales.find((l) => l.isDefault);

    return systemLocales.filter((locale) =>
      this.resolveLocationActive(locale, defaultLocale, mallMap.get(locale.id)),
    );
  }

  async updateForLocation(
    tenantId: string,
    mallId: string,
    dto: UpdateLocationLocalesDto,
    user: User,
  ): Promise<LocationLocaleRow[]> {
    const mall = await this.assertMall(tenantId, mallId);

    const systemLocales = await this.prisma.locale.findMany({
      where: { tenantId: mall.tenantId, isActive: true },
    });
    const defaultLocale = systemLocales.find((l) => l.isDefault);
    const localeById = new Map(systemLocales.map((l) => [l.id, l]));

    const enableIds: string[] = [];
    const disableIds: string[] = [];

    for (const item of dto.locales) {
      const locale = localeById.get(item.localeId);
      if (!locale) {
        throw new BadRequestException(`Geçersiz veya sistemde pasif dil kimliği: ${item.localeId}`);
      }
      if (defaultLocale && locale.id === defaultLocale.id && !item.isActive) {
        throw new BadRequestException('Varsayılan sistem dili lokasyonda devre dışı bırakılamaz.');
      }
      if (defaultLocale && locale.id === defaultLocale.id) continue;

      if (item.isActive) {
        enableIds.push(item.localeId);
      } else {
        disableIds.push(item.localeId);
      }
    }

    const resolvedActive = new Set<string>();
    if (defaultLocale) resolvedActive.add(defaultLocale.id);
    for (const id of enableIds) resolvedActive.add(id);

    if (resolvedActive.size < 1) {
      throw new BadRequestException('Lokasyonda en az bir dil aktif kalmalıdır.');
    }

    await this.prisma.$transaction([
      ...enableIds.map((localeId) =>
        this.prisma.mallLocale.upsert({
          where: { mallId_localeId: { mallId, localeId } },
          create: { tenantId: mall.tenantId, mallId, localeId, isActive: true },
          update: { isActive: true },
        }),
      ),
      ...disableIds.map((localeId) =>
        this.prisma.mallLocale.deleteMany({ where: { mallId, localeId } }),
      ),
    ]);

    await this.audit.logAction({
      userId: user.id,
      tenantId: mall.tenantId,
      mallId,
      action: 'location:locales:update',
      entityType: 'Location',
      entityId: mallId,
      after: {
        enabledLocaleIds: [...resolvedActive],
        disabledLocaleIds: disableIds,
      },
    });

    return this.listForLocation(mall.tenantId, mallId);
  }

  private resolveLocationActive(
    locale: Pick<Locale, 'id'>,
    defaultLocale: Pick<Locale, 'id'> | undefined,
    mallActive: boolean | undefined,
  ): boolean {
    if (defaultLocale && locale.id === defaultLocale.id) return true;
    return mallActive === true;
  }
}
