import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { slugify } from '../common/utils/slugify';
import { uniqueScreeningHallSlug } from '../common/utils/unique-content-slug';
import type { CreateScreeningHallDto } from './dto/create-screening-hall.dto';
import type { ListScreeningHallsDto } from './dto/list-screening-halls.dto';

const HALL_SELECT = {
  id: true,
  tenantId: true,
  mallId: true,
  cinemaId: true,
  name: true,
  slug: true,
  capacity: true,
  is3D: true,
  isImax: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export type ScreeningHallResponse = Prisma.ScreeningHallGetPayload<{ select: typeof HALL_SELECT }>;

@Injectable()
export class ScreeningHallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(
    tenantId: string,
    mallId: string,
    query: ListScreeningHallsDto,
  ): Promise<{ halls: ScreeningHallResponse[]; total: number }> {
    const where: Prisma.ScreeningHallWhereInput = {
      tenantId,
      mallId,
      deletedAt: null,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [halls, total] = await Promise.all([
      this.prisma.screeningHall.findMany({
        where,
        select: HALL_SELECT,
        orderBy: [{ name: 'asc' }],
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 100),
        take: query.limit ?? 100,
      }),
      this.prisma.screeningHall.count({ where }),
    ]);

    return { halls, total };
  }

  async findOrCreate(
    name: string,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<ScreeningHallResponse> {
    const slug = slugify(name);

    const existing = await this.prisma.screeningHall.findFirst({
      where: { tenantId, mallId, slug, deletedAt: null },
      select: HALL_SELECT,
    });
    if (existing) return existing;

    const uniqueSlug = await uniqueScreeningHallSlug(this.prisma, mallId, slug);
    const hall = await this.prisma.screeningHall.create({
      data: {
        tenantId,
        mallId,
        name,
        slug: uniqueSlug,
        createdBy: user.id,
      },
      select: HALL_SELECT,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'screening-hall:create',
      entityType: 'screening-hall',
      entityId: hall.id,
      after: { name: hall.name, slug: hall.slug },
    });

    return hall;
  }

  async create(
    dto: CreateScreeningHallDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<ScreeningHallResponse> {
    const slug = slugify(dto.name);
    const uniqueSlug = await uniqueScreeningHallSlug(this.prisma, mallId, slug);

    const hall = await this.prisma.screeningHall.create({
      data: {
        tenantId,
        mallId,
        cinemaId: dto.cinemaId ?? null,
        name: dto.name,
        slug: uniqueSlug,
        capacity: dto.capacity ?? null,
        is3D: dto.is3D ?? false,
        isImax: dto.isImax ?? false,
        createdBy: user.id,
      },
      select: HALL_SELECT,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'screening-hall:create',
      entityType: 'screening-hall',
      entityId: hall.id,
      after: { name: hall.name, slug: hall.slug },
    });

    return hall;
  }

  async remove(id: string, user: User, tenantId: string, mallId: string): Promise<void> {
    const hall = await this.prisma.screeningHall.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!hall) throw new NotFoundException('Salon bulunamadı');

    await this.prisma.screeningHall.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'screening-hall:delete',
      entityType: 'screening-hall',
      entityId: id,
      before: { name: hall.name },
    });
  }
}
