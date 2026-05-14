import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Cinema, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { slugify } from '../common/utils/slugify';
import { uniqueCinemaSlug } from '../common/utils/unique-content-slug';
import type { CreateCinemaDto } from './dto/create-cinema.dto';
import type { UpdateCinemaDto } from './dto/update-cinema.dto';
import type { ListCinemasDto } from './dto/list-cinemas.dto';

const LOGO_SELECT = { id: true, publicUrl: true, originalName: true, mimeType: true } as const;

const CINEMA_INCLUDE = {
  logoMedia: { select: LOGO_SELECT },
} satisfies Prisma.CinemaInclude;

export type CinemaResponse = Prisma.CinemaGetPayload<{ include: typeof CINEMA_INCLUDE }>;

@Injectable()
export class CinemasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleCinemaIndex(id: string): void {
    void this.searchIndexer.syncCinema(id).catch(() => undefined);
  }

  async list(
    tenantId: string,
    mallId: string,
    query: ListCinemasDto,
  ): Promise<{ cinemas: CinemaResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.CinemaWhereInput = {
      tenantId,
      mallId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };
    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    const sortBy = query.sortBy ?? 'name';
    const orderBy: Prisma.CinemaOrderByWithRelationInput =
      sortBy === 'createdAt' ? { createdAt: dir } : sortBy === 'slug' ? { slug: dir } : { name: dir };

    const [cinemas, total] = await Promise.all([
      this.prisma.cinema.findMany({
        where,
        include: CINEMA_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.cinema.count({ where }),
    ]);
    return { cinemas, total, page, limit };
  }

  async findOne(id: string, tenantId: string, mallId: string): Promise<CinemaResponse> {
    const row = await this.prisma.cinema.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
      include: CINEMA_INCLUDE,
    });
    if (!row) throw new NotFoundException('Sinema bulunamadı');
    return row;
  }

  async create(dto: CreateCinemaDto, user: User, tenantId: string, mallId: string): Promise<CinemaResponse> {
    if (dto.logoMediaId) {
      await this.assertLogoMedia(tenantId, mallId, dto.logoMediaId);
    }
    if (dto.providerConfigJson !== undefined && dto.providerConfigJson !== null) {
      if (typeof dto.providerConfigJson !== 'object' || Array.isArray(dto.providerConfigJson)) {
        throw new UnprocessableEntityException('providerConfigJson must be a JSON object');
      }
    }

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.name);
    const slug = await uniqueCinemaSlug(this.prisma, mallId, baseSlug);

    const cinema = await this.prisma.cinema.create({
      data: {
        tenantId,
        mallId,
        name: dto.name,
        slug,
        logoMediaId: dto.logoMediaId ?? null,
        description: dto.description ?? null,
        providerType: dto.providerType ?? 'MANUAL',
        providerConfigJson:
          dto.providerConfigJson === undefined
            ? undefined
            : (dto.providerConfigJson as Prisma.InputJsonValue),
        status: dto.status ?? 'ACTIVE',
        createdBy: user.id,
      },
      include: CINEMA_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'cinema:create',
      entityType: 'cinema',
      entityId: cinema.id,
      after: { name: cinema.name, slug: cinema.slug, status: cinema.status },
    });

    this.scheduleCinemaIndex(cinema.id);
    return cinema;
  }

  async update(
    id: string,
    dto: UpdateCinemaDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<CinemaResponse> {
    const existing = await this.assertExists(id, tenantId, mallId);

    if (dto.logoMediaId) {
      await this.assertLogoMedia(tenantId, mallId, dto.logoMediaId);
    }

    if (dto.providerConfigJson !== undefined && dto.providerConfigJson !== null) {
      if (typeof dto.providerConfigJson !== 'object' || Array.isArray(dto.providerConfigJson)) {
        throw new UnprocessableEntityException('providerConfigJson must be a JSON object');
      }
    }

    let slug = existing.slug;
    if (dto.slug !== undefined && dto.slug.trim().length > 0) {
      const candidate = slugify(dto.slug);
      slug =
        candidate === existing.slug
          ? existing.slug
          : await uniqueCinemaSlug(this.prisma, mallId, candidate, id);
    } else if (dto.name !== undefined && dto.name !== existing.name && dto.slug === undefined) {
      const candidate = slugify(dto.name);
      slug =
        candidate === existing.slug
          ? existing.slug
          : await uniqueCinemaSlug(this.prisma, mallId, candidate, id);
    }

    const providerPatch: { providerConfigJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull } = {};
    if (dto.providerConfigJson !== undefined) {
      providerPatch.providerConfigJson =
        dto.providerConfigJson === null ? Prisma.JsonNull : (dto.providerConfigJson as Prisma.InputJsonValue);
    }

    const cinema = await this.prisma.cinema.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        slug,
        ...(dto.logoMediaId !== undefined && { logoMediaId: dto.logoMediaId || null }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.providerType !== undefined && { providerType: dto.providerType }),
        ...providerPatch,
        ...(dto.status !== undefined && { status: dto.status }),
        updatedBy: user.id,
      },
      include: CINEMA_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'cinema:update',
      entityType: 'cinema',
      entityId: id,
      before: { name: existing.name, status: existing.status },
      after: { name: cinema.name, status: cinema.status },
    });

    this.scheduleCinemaIndex(id);
    return cinema;
  }

  async remove(id: string, user: User, tenantId: string, mallId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId, mallId);
    await this.prisma.cinema.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });
    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'cinema:delete',
      entityType: 'cinema',
      entityId: id,
      before: { name: existing.name, status: existing.status },
    });

    this.scheduleCinemaIndex(id);
  }

  async getPublicCinemas(opts: { tenantId: string; mallId: string }): Promise<CinemaResponse[]> {
    return this.prisma.cinema.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: CINEMA_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  private async assertExists(id: string, tenantId: string, mallId: string): Promise<Cinema> {
    const row = await this.prisma.cinema.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Sinema bulunamadı');
    return row;
  }

  private async assertLogoMedia(tenantId: string, mallId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, tenantId, deletedAt: null },
    });
    if (!media) {
      throw new UnprocessableEntityException('Logo medya bulunamadı');
    }
    if (media.mallId !== null && media.mallId !== mallId) {
      throw new UnprocessableEntityException('Logo medya bu AVM kapsamında olmalıdır');
    }
  }
}
