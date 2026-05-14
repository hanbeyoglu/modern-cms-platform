import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LocalizedContent, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { CreateTranslationDto } from './dto/create-translation.dto';
import type { UpdateTranslationDto } from './dto/update-translation.dto';
import type { ListTranslationsDto } from './dto/list-translations.dto';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(tenantId: string, query: ListTranslationsDto): Promise<LocalizedContent[]> {
    let resolvedLocaleId = query.localeId;

    if (!resolvedLocaleId && query.localeCode) {
      const locale = await this.prisma.locale.findUnique({
        where: { tenantId_code: { tenantId, code: query.localeCode } },
        select: { id: true },
      });
      if (!locale) throw new NotFoundException(`Locale "${query.localeCode}" not found`);
      resolvedLocaleId = locale.id;
    }

    return this.prisma.localizedContent.findMany({
      where: {
        tenantId,
        ...(resolvedLocaleId ? { localeId: resolvedLocaleId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
        ...(query.field ? { field: query.field } : {}),
      },
      orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }, { field: 'asc' }],
    });
  }

  // Upsert: if a translation already exists for the same (tenantId, localeId, entityType, entityId, field)
  // combination it is updated in-place rather than rejected. This makes idempotent bulk imports safe.
  async upsert(dto: CreateTranslationDto, user: User, tenantId: string): Promise<LocalizedContent> {
    const localeId = await this.resolveLocaleId(tenantId, dto.localeId, dto.localeCode);

    const existing = await this.prisma.localizedContent.findUnique({
      where: {
        tenantId_localeId_entityType_entityId_field: {
          tenantId,
          localeId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          field: dto.field,
        },
      },
    });

    if (existing) {
      const updated = await this.prisma.localizedContent.update({
        where: { id: existing.id },
        data: { value: dto.value },
      });

      await this.audit.logAction({
        userId: user.id,
        tenantId,
        action: 'translation:update',
        entityType: 'translation',
        entityId: updated.id,
        before: { value: existing.value },
        after: { value: updated.value },
      });

      return updated;
    }

    const translation = await this.prisma.localizedContent.create({
      data: {
        tenantId,
        localeId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        field: dto.field,
        value: dto.value,
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'translation:create',
      entityType: 'translation',
      entityId: translation.id,
      after: {
        localeId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        field: dto.field,
      },
    });

    return translation;
  }

  async update(
    id: string,
    dto: UpdateTranslationDto,
    user: User,
    tenantId: string,
  ): Promise<LocalizedContent> {
    const existing = await this.assertExists(id, tenantId);

    const translation = await this.prisma.localizedContent.update({
      where: { id },
      data: { value: dto.value },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'translation:update',
      entityType: 'translation',
      entityId: id,
      before: { value: existing.value },
      after: { value: translation.value },
    });

    return translation;
  }

  async remove(id: string, user: User, tenantId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId);

    await this.prisma.localizedContent.delete({ where: { id } });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'translation:delete',
      entityType: 'translation',
      entityId: id,
      before: {
        localeId: existing.localeId,
        entityType: existing.entityType,
        entityId: existing.entityId,
        field: existing.field,
      },
    });
  }

  private async resolveLocaleId(
    tenantId: string,
    localeId?: string,
    localeCode?: string,
  ): Promise<string> {
    if (localeId) {
      const locale = await this.prisma.locale.findFirst({
        where: { id: localeId, tenantId },
        select: { id: true },
      });
      if (!locale) throw new BadRequestException(`Locale not found in this tenant`);
      return locale.id;
    }

    if (localeCode) {
      const locale = await this.prisma.locale.findUnique({
        where: { tenantId_code: { tenantId, code: localeCode.toLowerCase() } },
        select: { id: true },
      });
      if (!locale) throw new BadRequestException(`Locale "${localeCode}" not found in this tenant`);
      return locale.id;
    }

    throw new BadRequestException('Either localeId or localeCode is required');
  }

  private async assertExists(id: string, tenantId: string): Promise<LocalizedContent> {
    const translation = await this.prisma.localizedContent.findFirst({
      where: { id, tenantId },
    });
    if (!translation) throw new NotFoundException('Translation not found');
    return translation;
  }
}
