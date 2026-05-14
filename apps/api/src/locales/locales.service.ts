import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Locale, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { CreateLocaleDto } from './dto/create-locale.dto';
import type { UpdateLocaleDto } from './dto/update-locale.dto';
import type { ListLocalesDto } from './dto/list-locales.dto';
import { rtlForLocaleCode } from './supported-languages';

@Injectable()
export class LocalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(tenantId: string, query: ListLocalesDto): Promise<Locale[]> {
    return this.prisma.locale.findMany({
      where: {
        tenantId,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { isDefault: 'desc' }, { code: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string): Promise<Locale> {
    return this.assertExists(id, tenantId);
  }

  async create(dto: CreateLocaleDto, user: User, tenantId: string): Promise<Locale> {
    const code = dto.code.toLowerCase().trim();

    const conflict = await this.prisma.locale.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (conflict) {
      throw new ConflictException(`Locale with code "${code}" already exists for this tenant`);
    }

    const isDefault = dto.isDefault ?? false;

    if (isDefault) {
      await this.prisma.locale.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const maxSort = await this.prisma.locale.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxSort._max.sortOrder ?? -1) + 1;

    const locale = await this.prisma.locale.create({
      data: {
        tenantId,
        code,
        name: dto.name,
        nativeName: dto.nativeName,
        isDefault,
        isActive: dto.isActive ?? true,
        sortOrder: nextOrder,
        rtl: rtlForLocaleCode(code),
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'locale:create',
      entityType: 'locale',
      entityId: locale.id,
      after: { code: locale.code, name: locale.name, isDefault: locale.isDefault },
    });

    return locale;
  }

  async update(id: string, dto: UpdateLocaleDto, user: User, tenantId: string): Promise<Locale> {
    const existing = await this.assertExists(id, tenantId);

    if (dto.isActive === false) {
      const activeCount = await this.prisma.locale.count({
        where: { tenantId, isActive: true },
      });
      if (activeCount <= 1 && existing.isActive) {
        throw new BadRequestException('En az bir aktif dil açık kalmalıdır.');
      }
      if (existing.isDefault) {
        throw new BadRequestException(
          'Varsayılan dili pasifleştirmek için önce başka bir dili varsayılan yapın veya pasifleştir işlemini kullanın.',
        );
      }
    }

    if (dto.code !== undefined) {
      const code = dto.code.toLowerCase().trim();
      if (code !== existing.code) {
        const conflict = await this.prisma.locale.findUnique({
          where: { tenantId_code: { tenantId, code } },
        });
        if (conflict) {
          throw new ConflictException(`Locale with code "${code}" already exists for this tenant`);
        }
      }
    }

    const nextCode = dto.code !== undefined ? dto.code.toLowerCase().trim() : existing.code;
    const locale = await this.prisma.locale.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: nextCode }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nativeName !== undefined && { nativeName: dto.nativeName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.rtl !== undefined && { rtl: dto.rtl }),
        ...(dto.code !== undefined && { rtl: rtlForLocaleCode(nextCode) }),
      },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'locale:update',
      entityType: 'locale',
      entityId: locale.id,
      before: { code: existing.code, name: existing.name, isActive: existing.isActive },
      after: { code: locale.code, name: locale.name, isActive: locale.isActive },
    });

    return locale;
  }

  // Deactivation instead of hard delete to preserve LocalizedContent referential integrity.
  // Physical delete would cascade-delete all translations for this locale, which is destructive.
  // Deactivated locales are excluded from public resolution but translations are retained.
  async deactivate(id: string, user: User, tenantId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId);

    if (existing.isDefault) {
      const otherActive = await this.prisma.locale.findFirst({
        where: { tenantId, id: { not: id }, isActive: true },
      });
      if (!otherActive) {
        throw new BadRequestException(
          'Cannot deactivate the default locale when no other active locale exists. ' +
            'Create or activate another locale first.',
        );
      }
      // Transfer default to the next active locale in the same transaction
      await this.prisma.$transaction([
        this.prisma.locale.update({
          where: { id: otherActive.id },
          data: { isDefault: true },
        }),
        this.prisma.locale.update({
          where: { id },
          data: { isDefault: false, isActive: false },
        }),
      ]);
    } else {
      await this.prisma.locale.update({
        where: { id },
        data: { isActive: false },
      });
    }

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'locale:delete',
      entityType: 'locale',
      entityId: id,
      before: { code: existing.code, isDefault: existing.isDefault, isActive: existing.isActive },
      after: { isActive: false },
    });
  }

  async setDefault(id: string, user: User, tenantId: string): Promise<Locale> {
    const locale = await this.assertExists(id, tenantId);

    if (!locale.isActive) {
      throw new BadRequestException('Cannot set an inactive locale as default');
    }

    if (locale.isDefault) {
      return locale;
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.locale.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.locale.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'locale:set-default',
      entityType: 'locale',
      entityId: id,
      before: { isDefault: locale.isDefault },
      after: { isDefault: true },
    });

    return updated;
  }

  /** Persist tab / switcher order for active languages. */
  async reorder(orderedIds: string[], user: User, tenantId: string): Promise<Locale[]> {
    const unique = [...new Set(orderedIds)];
    if (unique.length !== orderedIds.length) {
      throw new BadRequestException('Yinelenen dil kimliği');
    }
    const rows = await this.prisma.locale.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('Bazı diller bu tenant için bulunamadı');
    }

    const allCount = await this.prisma.locale.count({ where: { tenantId } });
    if (unique.length !== allCount) {
      throw new BadRequestException('Sıralama listesi bu tenanttaki tüm dilleri içermelidir');
    }

    await this.prisma.$transaction(
      unique.map((localeId, index) =>
        this.prisma.locale.update({
          where: { id: localeId },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'locale:reorder',
      entityType: 'locale',
      entityId: tenantId,
      after: { orderedIds: unique },
    });

    return this.list(tenantId, {});
  }

  private async assertExists(id: string, tenantId: string): Promise<Locale> {
    const locale = await this.prisma.locale.findFirst({
      where: { id, tenantId },
    });
    if (!locale) throw new NotFoundException('Locale not found');
    return locale;
  }
}
