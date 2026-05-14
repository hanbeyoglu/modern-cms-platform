import { Injectable } from '@nestjs/common';
import type { Locale, LocalizedContent, LocalizedEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface EntityTranslationMap {
  [entityId: string]: { [field: string]: string };
}

@Injectable()
export class TranslationResolverService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns the locale to use for a given request.
  // Falls back to the tenant default when the requested code is unknown or inactive.
  async resolveLocale(tenantId: string, requestedLocaleCode?: string): Promise<Locale | null> {
    if (requestedLocaleCode) {
      const locale = await this.prisma.locale.findUnique({
        where: { tenantId_code: { tenantId, code: requestedLocaleCode.toLowerCase() } },
      });
      if (locale?.isActive) return locale;
    }
    return this.getDefaultLocale(tenantId);
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
