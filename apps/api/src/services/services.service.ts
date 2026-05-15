import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Service, ServiceStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';
import type { ListServicesDto } from './dto/list-services.dto';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
  altText: true,
  caption: true,
  width: true,
  height: true,
  dominantColor: true,
} as const;

const SERVICE_INCLUDE = {
  iconMedia: { select: MEDIA_SELECT },
  coverMedia: { select: MEDIA_SELECT },
} satisfies Prisma.ServiceInclude;

export type ServiceResponse = Prisma.ServiceGetPayload<{ include: typeof SERVICE_INCLUDE }>;

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleIndex(id: string): void {
    void this.searchIndexer.syncService(id).catch(() => undefined);
  }

  async list(
    tenantId: string,
    mallId: string,
    query: ListServicesDto,
  ): Promise<{ services: ServiceResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {
      tenantId,
      mallId,
      deletedAt: null,
      ...(query.status ? { status: query.status as ServiceStatus } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [services, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: SERVICE_INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    return { services, total, page, limit };
  }

  async findOne(id: string, tenantId: string): Promise<ServiceResponse> {
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: SERVICE_INCLUDE,
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(
    dto: CreateServiceDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<ServiceResponse> {
    const service = await this.prisma.service.create({
      data: {
        tenantId,
        mallId,
        name: dto.name,
        description: dto.description ?? null,
        iconMediaId: dto.iconMediaId ?? null,
        coverMediaId: dto.coverMediaId ?? null,
        category: dto.category ?? null,
        floor: dto.floor ?? null,
        unitNo: dto.unitNo ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        websiteUrl: dto.websiteUrl ?? null,
        locationLabel: dto.locationLabel ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        searchTags: dto.searchTags ?? [],
        isSoon: dto.isSoon ?? false,
        status: (dto.status as ServiceStatus) ?? 'ACTIVE',
        sortOrder: dto.sortOrder ?? 0,
        metadataJson: dto.metadataJson ? (dto.metadataJson as Prisma.InputJsonValue) : undefined,
        createdBy: user.id,
      },
      include: SERVICE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'service:create',
      entityType: 'service',
      entityId: service.id,
      after: { name: service.name, status: service.status },
    });

    this.scheduleIndex(service.id);
    return service;
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
    user: User,
    tenantId: string,
  ): Promise<ServiceResponse> {
    const existing = await this.assertExists(id, tenantId);

    const service = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.iconMediaId !== undefined && { iconMediaId: dto.iconMediaId || null }),
        ...(dto.coverMediaId !== undefined && { coverMediaId: dto.coverMediaId || null }),
        ...(dto.category !== undefined && { category: dto.category || null }),
        ...(dto.floor !== undefined && { floor: dto.floor || null }),
        ...(dto.unitNo !== undefined && { unitNo: dto.unitNo || null }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
        ...(dto.email !== undefined && { email: dto.email || null }),
        ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl || null }),
        ...(dto.locationLabel !== undefined && { locationLabel: dto.locationLabel || null }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.searchTags !== undefined && { searchTags: dto.searchTags }),
        ...(dto.isSoon !== undefined && { isSoon: dto.isSoon }),
        ...(dto.status !== undefined && { status: dto.status as ServiceStatus }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.metadataJson !== undefined && { metadataJson: dto.metadataJson as Prisma.InputJsonValue }),
        updatedBy: user.id,
      },
      include: SERVICE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: service.mallId,
      action: 'service:update',
      entityType: 'service',
      entityId: service.id,
      before: { name: existing.name, status: existing.status },
      after: { name: service.name, status: service.status },
    });

    this.scheduleIndex(service.id);
    return service;
  }

  async remove(id: string, user: User, tenantId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId);

    await this.prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: existing.mallId,
      action: 'service:delete',
      entityType: 'service',
      entityId: id,
      before: { name: existing.name, status: existing.status },
    });

    this.scheduleIndex(id);
  }

  async getActiveForPublic(opts: { tenantId: string; mallId: string }): Promise<ServiceResponse[]> {
    return this.prisma.service.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'ACTIVE' as ServiceStatus,
      },
      include: SERVICE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private async assertExists(id: string, tenantId: string): Promise<Service> {
    const service = await this.prisma.service.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}
