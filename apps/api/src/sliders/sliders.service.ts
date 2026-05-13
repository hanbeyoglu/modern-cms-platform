import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma, Slider, SliderStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import type { CreateSliderDto } from './dto/create-slider.dto';
import type { UpdateSliderDto } from './dto/update-slider.dto';
import type { ListSlidersDto } from './dto/list-sliders.dto';
import type { ReorderSlidersDto } from './dto/reorder-sliders.dto';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
} as const;

const SLIDER_INCLUDE = {
  desktopMedia: { select: MEDIA_SELECT },
  mobileMedia: { select: MEDIA_SELECT },
  videoMedia: { select: MEDIA_SELECT },
} satisfies Prisma.SliderInclude;

export type SliderResponse = Prisma.SliderGetPayload<{ include: typeof SLIDER_INCLUDE }>;

@Injectable()
export class SlidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(
    tenantId: string,
    mallId: string | undefined,
    query: ListSlidersDto,
  ): Promise<{ sliders: SliderResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SliderWhereInput = {
      tenantId,
      deletedAt: null,
      ...(mallId !== undefined ? { mallId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetDevice ? { targetDevice: query.targetDevice } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [sliders, total] = await Promise.all([
      this.prisma.slider.findMany({
        where,
        include: SLIDER_INCLUDE,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.slider.count({ where }),
    ]);

    return { sliders, total, page, limit };
  }

  async findOne(id: string, tenantId: string): Promise<SliderResponse> {
    const slider = await this.prisma.slider.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: SLIDER_INCLUDE,
    });
    if (!slider) throw new NotFoundException('Slider not found');
    return slider;
  }

  async create(
    dto: CreateSliderDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<SliderResponse> {
    this.validateDates(dto.startAt, dto.endAt);

    const status = dto.status ?? 'DRAFT';
    if (status === 'PUBLISHED') {
      this.assertHasMedia(dto.desktopMediaId, dto.mobileMediaId, dto.videoMediaId);
    }
    if (dto.linkType === 'EXTERNAL_URL') {
      this.assertValidUrl(dto.linkValue);
    }

    const slider = await this.prisma.slider.create({
      data: {
        tenantId,
        mallId: mallId ?? null,
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        description: dto.description ?? null,
        desktopMediaId: dto.desktopMediaId ?? null,
        mobileMediaId: dto.mobileMediaId ?? null,
        videoMediaId: dto.videoMediaId ?? null,
        linkType: dto.linkType ?? 'NONE',
        linkValue: dto.linkValue ?? null,
        buttonText: dto.buttonText ?? null,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        sortOrder: dto.sortOrder ?? 0,
        status,
        targetDevice: dto.targetDevice ?? 'ALL',
        createdBy: user.id,
      },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'slider:create',
      entityType: 'slider',
      entityId: slider.id,
      after: { title: slider.title, status: slider.status },
    });

    return slider;
  }

  async update(
    id: string,
    dto: UpdateSliderDto,
    user: User,
    tenantId: string,
  ): Promise<SliderResponse> {
    const existing = await this.assertExists(id, tenantId);

    this.validateDates(dto.startAt, dto.endAt);

    const nextDesktopMediaId = dto.desktopMediaId !== undefined ? dto.desktopMediaId : existing.desktopMediaId;
    const nextMobileMediaId = dto.mobileMediaId !== undefined ? dto.mobileMediaId : existing.mobileMediaId;
    const nextVideoMediaId = dto.videoMediaId !== undefined ? dto.videoMediaId : existing.videoMediaId;
    const nextStatus = dto.status ?? existing.status;
    const nextLinkType = dto.linkType ?? existing.linkType;
    const nextLinkValue = dto.linkValue !== undefined ? dto.linkValue : existing.linkValue;

    if (nextStatus === 'PUBLISHED') {
      this.assertHasMedia(nextDesktopMediaId ?? undefined, nextMobileMediaId ?? undefined, nextVideoMediaId ?? undefined);
    }
    if (nextLinkType === 'EXTERNAL_URL') {
      this.assertValidUrl(nextLinkValue ?? undefined);
    }

    const slider = await this.prisma.slider.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.desktopMediaId !== undefined && { desktopMediaId: dto.desktopMediaId || null }),
        ...(dto.mobileMediaId !== undefined && { mobileMediaId: dto.mobileMediaId || null }),
        ...(dto.videoMediaId !== undefined && { videoMediaId: dto.videoMediaId || null }),
        ...(dto.linkType !== undefined && { linkType: dto.linkType }),
        ...(dto.linkValue !== undefined && { linkValue: dto.linkValue || null }),
        ...(dto.buttonText !== undefined && { buttonText: dto.buttonText || null }),
        ...(dto.startAt !== undefined && { startAt: dto.startAt ? new Date(dto.startAt) : null }),
        ...(dto.endAt !== undefined && { endAt: dto.endAt ? new Date(dto.endAt) : null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.targetDevice !== undefined && { targetDevice: dto.targetDevice }),
        updatedBy: user.id,
      },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: slider.mallId ?? undefined,
      action: 'slider:update',
      entityType: 'slider',
      entityId: slider.id,
      before: { title: existing.title, status: existing.status },
      after: { title: slider.title, status: slider.status },
    });

    return slider;
  }

  async remove(id: string, user: User, tenantId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId);

    await this.prisma.slider.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: existing.mallId ?? undefined,
      action: 'slider:delete',
      entityType: 'slider',
      entityId: id,
      before: { title: existing.title, status: existing.status },
    });
  }

  async publish(id: string, user: User, tenantId: string): Promise<SliderResponse> {
    const existing = await this.assertExists(id, tenantId);

    this.assertHasMedia(
      existing.desktopMediaId ?? undefined,
      existing.mobileMediaId ?? undefined,
      existing.videoMediaId ?? undefined,
    );

    const slider = await this.prisma.slider.update({
      where: { id },
      data: { status: 'PUBLISHED', updatedBy: user.id },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: slider.mallId ?? undefined,
      action: 'slider:publish',
      entityType: 'slider',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'PUBLISHED' },
    });

    return slider;
  }

  async archive(id: string, user: User, tenantId: string): Promise<SliderResponse> {
    const existing = await this.assertExists(id, tenantId);

    const slider = await this.prisma.slider.update({
      where: { id },
      data: { status: 'ARCHIVED', updatedBy: user.id },
      include: SLIDER_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: slider.mallId ?? undefined,
      action: 'slider:archive',
      entityType: 'slider',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'ARCHIVED' },
    });

    return slider;
  }

  async reorder(
    dto: ReorderSlidersDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<void> {
    if (dto.items.length === 0) return;

    const ids = dto.items.map((i) => i.id);

    // Validate all sliders belong to this tenant (and optionally mall)
    const existing = await this.prisma.slider.findMany({
      where: {
        id: { in: ids },
        tenantId,
        deletedAt: null,
        ...(mallId !== undefined ? { mallId } : {}),
      },
      select: { id: true },
    });

    if (existing.length !== ids.length) {
      throw new BadRequestException('One or more sliders not found in this tenant/mall scope');
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.slider.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder, updatedBy: user.id },
        }),
      ),
    );

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'slider:reorder',
      entityType: 'slider',
      after: { itemCount: dto.items.length, ids },
    });
  }

  // ─── Public-facing service method (for future public website use) ─────────────

  async getPublishedSlidersForPublic(opts: {
    tenantId: string;
    mallId?: string;
    targetDevice?: string;
  }): Promise<SliderResponse[]> {
    const now = new Date();

    return this.prisma.slider.findMany({
      where: {
        tenantId: opts.tenantId,
        deletedAt: null,
        status: 'PUBLISHED' as SliderStatus,
        ...(opts.mallId !== undefined ? { mallId: opts.mallId } : {}),
        ...(opts.targetDevice ? { targetDevice: opts.targetDevice as Slider['targetDevice'] } : {}),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      include: SLIDER_INCLUDE,
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async assertExists(id: string, tenantId: string): Promise<Slider> {
    const slider = await this.prisma.slider.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!slider) throw new NotFoundException('Slider not found');
    return slider;
  }

  private assertHasMedia(
    desktopMediaId?: string,
    mobileMediaId?: string,
    videoMediaId?: string,
  ): void {
    if (!desktopMediaId && !mobileMediaId && !videoMediaId) {
      throw new UnprocessableEntityException(
        'At least one media asset (desktop, mobile, or video) is required to publish a slider',
      );
    }
  }

  private assertValidUrl(linkValue?: string): void {
    if (!linkValue) {
      throw new BadRequestException('linkValue is required when linkType is EXTERNAL_URL');
    }
    try {
      new URL(linkValue);
    } catch {
      throw new BadRequestException('linkValue must be a valid URL for EXTERNAL_URL link type');
    }
  }

  private validateDates(startAt?: string, endAt?: string): void {
    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      throw new BadRequestException('startAt must be before endAt');
    }
  }
}
