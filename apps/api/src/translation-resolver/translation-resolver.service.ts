import { Injectable } from '@nestjs/common';
import type { Locale, LocalizedContent, LocalizedEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MallLocalesService } from '../mall-locales/mall-locales.service';

export interface EntityTranslationMap {
  [entityId: string]: { [field: string]: string };
}

@Injectable()
export class TranslationResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mallLocales: MallLocalesService,
  ) {}

  // Returns the locale to use for a given request.
  // Falls back to the tenant default when the requested code is unknown or inactive.
  async resolveLocale(
    tenantId: string,
    requestedLocaleCode?: string,
    mallId?: string | null,
  ): Promise<Locale | null> {
    const activeLocales = mallId
      ? await this.mallLocales.getActiveLocalesForMall(tenantId, mallId)
      : await this.getActiveLocalesOrdered(tenantId);

    const normalized = this.normalizeLocaleCode(requestedLocaleCode);
    if (normalized) {
      const locale = activeLocales.find((l) => l.code === normalized);
      if (locale) return locale;
    }

    return (
      activeLocales.find((l) => l.isDefault) ??
      (await this.getDefaultLocale(tenantId)) ??
      activeLocales[0] ??
      null
    );
  }

  /** Safe for untrusted query/header values (no throw). */
  normalizeLocaleCode(requestedLocaleCode?: string): string | undefined {
    if (!requestedLocaleCode || typeof requestedLocaleCode !== 'string') return undefined;
    const t = requestedLocaleCode.trim().toLowerCase();
    if (!t) return undefined;
    return t.slice(0, 32);
  }

  async getDefaultLocale(tenantId: string): Promise<Locale | null> {
    return this.prisma.locale.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });
  }

  async getTranslationsForEntity(
    tenantId: string,
    localeId: string,
    entityType: LocalizedEntityType,
    entityId: string,
  ): Promise<LocalizedContent[]> {
    return this.prisma.localizedContent.findMany({
      where: { tenantId, localeId, entityType, entityId },
    });
  }

  // Batch loader — fetches all translations for multiple entities in a single query
  // to avoid N+1 when building list responses in Sprint 12B.
  async getTranslationsForEntities(
    tenantId: string,
    localeId: string,
    entityType: LocalizedEntityType,
    entityIds: string[],
  ): Promise<EntityTranslationMap> {
    if (entityIds.length === 0) return {};

    const rows = await this.prisma.localizedContent.findMany({
      where: { tenantId, localeId, entityType, entityId: { in: entityIds } },
    });

    const result: EntityTranslationMap = {};
    for (const row of rows) {
      if (!result[row.entityId]) result[row.entityId] = {};
      result[row.entityId][row.field] = row.value;
    }
    return result;
  }

  /** Active locales for forms and public language switchers (Sprint 21). */
  async getActiveLocalesOrdered(tenantId: string): Promise<Locale[]> {
    return this.prisma.locale.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  /**
   * Non-blocking hints when default (canonical) fields are filled but an enabled
   * locale is missing matching LocalizedContent rows.
   */
  async getI18nGapWarnings(
    tenantId: string,
    entityType: LocalizedEntityType,
    entityId: string,
    fields: string[],
    baseValues: Record<string, string | null | undefined>,
  ): Promise<string[]> {
    const locales = await this.getActiveLocalesOrdered(tenantId);
    const def = locales.find((l) => l.isDefault);
    if (!def || locales.length < 2) return [];

    const rows = await this.prisma.localizedContent.findMany({
      where: { tenantId, entityType, entityId },
      select: { localeId: true, field: true, value: true },
    });
    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(`${r.localeId}:${r.field}`, r.value);
    }

    const fieldLabel: Record<string, string> = {
      title: 'başlık',
      shortDescription: 'kısa açıklama',
      description: 'açıklama',
      buttonText: 'buton metni',
      terms: 'şartlar',
      subtitle: 'alt başlık',
      seoTitle: 'SEO başlığı',
      seoDescription: 'SEO açıklaması',
    };

    const warnings: string[] = [];
    for (const loc of locales) {
      if (loc.id === def.id) continue;
      for (const field of fields) {
        const base = (baseValues[field] ?? '').trim();
        if (!base) continue;
        const tr = (map.get(`${loc.id}:${field}`) ?? '').trim();
        if (!tr) {
          warnings.push(
            `"${loc.nativeName}" (${loc.code}) için ${fieldLabel[field] ?? field} çevirisi yok`,
          );
        }
      }
    }
    return warnings;
  }

  // Overlays translated field values onto a base object.
  // fieldMap maps object property names to translation field names.
  // If fieldMap is omitted, property names are treated as identical to field names.
  // Returns a shallow copy — the original object is not mutated.
  applyTranslationsToObject<T extends Record<string, unknown>>(
    baseObject: T,
    translations: LocalizedContent[],
    fieldMap?: Record<string, string>,
  ): T {
    const translationByField: Record<string, string> = {};
    for (const t of translations) {
      translationByField[t.field] = t.value;
    }

    const result = { ...baseObject };
    const keys = fieldMap ? Object.keys(fieldMap) : Object.keys(translationByField);

    for (const key of keys) {
      const fieldName = fieldMap ? fieldMap[key] : key;
      if (fieldName !== undefined && translationByField[fieldName] !== undefined) {
        (result as Record<string, unknown>)[key] = translationByField[fieldName];
      }
    }

    return result;
  }
}
