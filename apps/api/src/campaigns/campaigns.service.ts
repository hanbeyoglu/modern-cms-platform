import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Campaign, ContentStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { slugify } from '../common/utils/slugify';
import { assertOptionalHttpUrl, validateStartBeforeEnd } from '../common/utils/content-validation';
import {
  resolveContentPublishSchedule,
  toScheduleDate,
} from '../common/utils/publish-workflow';
import { uniqueCampaignSlug } from '../common/utils/unique-content-slug';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';
import type { ListCampaignsDto } from './dto/list-campaigns.dto';
import type { CampaignTranslationDto } from './dto/campaign-translation.dto.js';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  originalName: true,
  mimeType: true,
  width: true,
  height: true,
} as const;

const CAMPAIGN_INCLUDE = {
  sharedCoverImage: { select: MEDIA_SELECT },
  translations: {
    include: {
      locale: { select: { id: true, code: true } },
      coverImage: { select: MEDIA_SELECT },
    },
  },
  store: {
    select: {
      id: true,
      mallId: true,
      tenantId: true,
      localName: true,
      globalStore: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.CampaignInclude;

export type CampaignResponse = Prisma.CampaignGetPayload<{ include: typeof CAMPAIGN_INCLUDE }>;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleCampaignIndex(id: string): void {
    void this.searchIndexer.syncCampaign(id).catch(() => undefined);
  }

  async list(
    tenantId: string,
    mallId: string | undefined,
    query: ListCampaignsDto,
  ): Promise<{ campaigns: CampaignResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(tenantId, mallId, query);
    const orderBy = this.buildOrderBy(query);

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        include: CAMPAIGN_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { campaigns, total, page, limit };
  }

  async findOne(id: string, tenantId: string, mallId: string | undefined): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: CAMPAIGN_INCLUDE,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    this.assertMallVisibility(campaign, mallId);
    return campaign;
  }

  async create(
    dto: CreateCampaignDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<CampaignResponse> {
    assertOptionalHttpUrl(dto.linkUrl);

    const status = dto.status ?? 'DRAFT';
    const publishSchedule = resolveContentPublishSchedule({
      status,
      publishStartAt: dto.publishStartAt,
      publishEndAt: dto.publishEndAt,
    });
    const campaignStartAt = toScheduleDate(dto.campaignStartAt);
    const campaignEndAt = toScheduleDate(dto.campaignEndAt);
    validateStartBeforeEnd(campaignStartAt, campaignEndAt);

    const effectiveMallId = mallId ?? null;
    const sameImageForAllLocales = dto.sameImageForAllLocales ?? true;

    if (dto.storeId) {
      await this.assertMallStoreInScope(tenantId, effectiveMallId, dto.storeId);
    }

    await this.assertCoverMediaValid({
      tenantId,
      mallId: effectiveMallId,
      sameImageForAllLocales,
      sharedCoverImageId: dto.sharedCoverImageId,
      translations: dto.translations,
    });

    if (status === 'PUBLISHED') {
      await this.assertPublishable({
        title: dto.title,
        campaignStartAt,
        tenantId,
        mallId: effectiveMallId,
        sameImageForAllLocales,
        sharedCoverImageId: dto.sharedCoverImageId,
        translations: dto.translations,
        storeId: dto.storeId,
      });
    }

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.title);
    const slug = await uniqueCampaignSlug(this.prisma, tenantId, baseSlug);
    const dynamicFieldsJson = this.toPrismaJson(dto.dynamicFieldsJson);

    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        mallId: effectiveMallId,
        storeId: dto.storeId ?? null,
        title: dto.title,
        slug,
        shortDescription: dto.shortDescription ?? null,
        description: dto.description ?? null,
        sameImageForAllLocales,
        sharedCoverImageId: dto.sharedCoverImageId ?? null,
        coverMediaWidthOverride: dto.coverMediaWidthOverride ?? null,
        coverMediaHeightOverride: dto.coverMediaHeightOverride ?? null,
        publishStartAt: publishSchedule.publishStartAt,
        publishEndAt: publishSchedule.publishEndAt,
        campaignStartAt,
        campaignEndAt,
        terms: dto.terms ?? null,
        couponCode: dto.couponCode ?? null,
        buttonText: dto.buttonText ?? null,
        linkUrl: dto.linkUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        status,
        channels: dto.channels ?? ['WEB', 'MOBILE'],
        dynamicFieldsJson: dynamicFieldsJson ?? undefined,
        createdBy: user.id,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      include: CAMPAIGN_INCLUDE,
    });

    if (dto.translations?.length) {
      await this.upsertTranslations(campaign.id, dto.translations);
    }

    const result = await this.findOne(campaign.id, tenantId, mallId);

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? campaign.mallId ?? undefined,
      action: 'campaign:create',
      entityType: 'campaign',
      entityId: campaign.id,
      after: { title: campaign.title, status: campaign.status, slug: campaign.slug },
    });

    this.scheduleCampaignIndex(campaign.id);
    return result;
  }

  async update(
    id: string,
    dto: UpdateCampaignDto,
    user: User,
    tenantId: string,
    mallId: string | undefined,
  ): Promise<CampaignResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    const nextLink = dto.linkUrl !== undefined ? dto.linkUrl : existing.linkUrl;
    assertOptionalHttpUrl(nextLink);

    const nextTitle = dto.title ?? existing.title;
    const nextStatus = dto.status ?? existing.status;
    const sameImageForAllLocales = dto.sameImageForAllLocales ?? existing.sameImageForAllLocales;
    const nextSharedCover =
      dto.sharedCoverImageId !== undefined ? dto.sharedCoverImageId : existing.sharedCoverImageId;

    const publishSchedule = resolveContentPublishSchedule({
      status: nextStatus,
      publishStartAt:
        dto.publishStartAt !== undefined
          ? dto.publishStartAt
          : existing.publishStartAt,
      publishEndAt:
        dto.publishEndAt !== undefined ? dto.publishEndAt : existing.publishEndAt,
    });
    const campaignStartAt =
      dto.campaignStartAt !== undefined
        ? toScheduleDate(dto.campaignStartAt)
        : existing.campaignStartAt;
    const campaignEndAt =
      dto.campaignEndAt !== undefined ? toScheduleDate(dto.campaignEndAt) : existing.campaignEndAt;
    validateStartBeforeEnd(campaignStartAt, campaignEndAt);

    const nextMallId = dto.mallId !== undefined ? dto.mallId : existing.mallId;
    const nextStoreId = dto.storeId !== undefined ? dto.storeId : existing.storeId;

    if (dto.sharedCoverImageId) {
      await this.assertCoverMediaInScope(tenantId, nextMallId, dto.sharedCoverImageId);
    }

    if (dto.storeId !== undefined && dto.storeId) {
      await this.assertMallStoreInScope(tenantId, nextMallId, dto.storeId);
    }

    await this.assertCoverMediaValid({
      tenantId,
      mallId: nextMallId,
      sameImageForAllLocales,
      sharedCoverImageId: nextSharedCover,
      translations: dto.translations,
      campaignId: id,
      skipWhenDraft: nextStatus !== 'PUBLISHED',
    });

    if (nextStatus === 'PUBLISHED') {
      await this.assertPublishable({
        title: nextTitle,
        campaignStartAt,
        tenantId,
        mallId: nextMallId,
        sameImageForAllLocales,
        sharedCoverImageId: nextSharedCover ?? undefined,
        translations: dto.translations,
        campaignId: id,
        storeId: nextStoreId ?? undefined,
      });
    }

    let slug = existing.slug;
    if (dto.slug !== undefined && dto.slug.trim().length > 0) {
      const candidate = slugify(dto.slug);
      slug =
        candidate === existing.slug ? existing.slug : await uniqueCampaignSlug(this.prisma, tenantId, candidate, id);
    } else if (dto.title !== undefined && dto.title !== existing.title && dto.slug === undefined) {
      const candidate = slugify(dto.title);
      slug =
        candidate === existing.slug ? existing.slug : await uniqueCampaignSlug(this.prisma, tenantId, candidate, id);
    }

    const publishedPatch: { publishedAt?: Date | null } = {};
    if (nextStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      publishedPatch.publishedAt = new Date();
    } else if (
      (nextStatus === 'DRAFT' || nextStatus === 'SCHEDULED') &&
      existing.status === 'PUBLISHED'
    ) {
      publishedPatch.publishedAt = null;
    }

    await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        slug,
        ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription || null }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.sameImageForAllLocales !== undefined && { sameImageForAllLocales }),
        ...(dto.sharedCoverImageId !== undefined && { sharedCoverImageId: dto.sharedCoverImageId || null }),
        ...(dto.coverMediaWidthOverride !== undefined && {
          coverMediaWidthOverride: dto.coverMediaWidthOverride,
        }),
        ...(dto.coverMediaHeightOverride !== undefined && {
          coverMediaHeightOverride: dto.coverMediaHeightOverride,
        }),
        publishStartAt: publishSchedule.publishStartAt,
        publishEndAt: publishSchedule.publishEndAt,
        campaignStartAt,
        campaignEndAt,
        ...(dto.terms !== undefined && { terms: dto.terms || null }),
        ...(dto.couponCode !== undefined && { couponCode: dto.couponCode || null }),
        ...(dto.buttonText !== undefined && { buttonText: dto.buttonText || null }),
        ...(dto.linkUrl !== undefined && { linkUrl: dto.linkUrl || null }),
        ...(dto.storeId !== undefined && { storeId: dto.storeId || null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.channels !== undefined && { channels: dto.channels }),
        ...(dto.dynamicFieldsJson !== undefined
          ? {
              dynamicFieldsJson:
                dto.dynamicFieldsJson === null
                  ? Prisma.JsonNull
                  : (dto.dynamicFieldsJson as Prisma.InputJsonValue),
            }
          : {}),
        ...(dto.mallId !== undefined && { mallId: dto.mallId }),
        updatedBy: user.id,
        ...publishedPatch,
      },
    });

    if (dto.translations !== undefined) {
      await this.upsertTranslations(id, dto.translations);
    }

    const campaign = await this.findOne(id, tenantId, mallId);

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? campaign.mallId ?? undefined,
      action: 'campaign:update',
      entityType: 'campaign',
      entityId: campaign.id,
      before: { title: existing.title, status: existing.status },
      after: { title: campaign.title, status: campaign.status },
    });

    this.scheduleCampaignIndex(campaign.id);
    return campaign;
  }

  async remove(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<void> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? existing.mallId ?? undefined,
      action: 'campaign:delete',
      entityType: 'campaign',
      entityId: id,
      before: { title: existing.title, status: existing.status },
    });

    this.scheduleCampaignIndex(id);
  }

  async publish(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<CampaignResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    await this.assertPublishable({
      title: existing.title,
      campaignStartAt: existing.campaignStartAt,
      tenantId,
      mallId: existing.mallId,
      sameImageForAllLocales: existing.sameImageForAllLocales,
      sharedCoverImageId: existing.sharedCoverImageId ?? undefined,
      campaignId: id,
      storeId: existing.storeId ?? undefined,
    });

    const now = new Date();
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        publishStartAt: existing.publishStartAt ?? now,
        updatedBy: user.id,
      },
      include: CAMPAIGN_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? campaign.mallId ?? undefined,
      action: 'campaign:publish',
      entityType: 'campaign',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'PUBLISHED', publishedAt: campaign.publishedAt },
    });

    this.scheduleCampaignIndex(campaign.id);
    return campaign;
  }

  async archive(id: string, user: User, tenantId: string, mallId: string | undefined): Promise<CampaignResponse> {
    const existing = await this.assertExists(id, tenantId);
    this.assertMallVisibility(existing, mallId);

    const now = new Date();
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        publishEndAt: existing.publishEndAt ?? now,
        updatedBy: user.id,
      },
      include: CAMPAIGN_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId: mallId ?? campaign.mallId ?? undefined,
      action: 'campaign:archive',
      entityType: 'campaign',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'ARCHIVED' },
    });

    this.scheduleCampaignIndex(campaign.id);
    return campaign;
  }

  async getPublishedCampaignsForPublic(opts: {
    tenantId: string;
    mallId?: string;
    storeId?: string;
    search?: string;
    channel?: string;
  }): Promise<CampaignResponse[]> {
    const now = new Date();
    const where: Prisma.CampaignWhereInput = {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'PUBLISHED' as ContentStatus,
      AND: [
        { OR: [{ publishStartAt: null }, { publishStartAt: { lte: now } }] },
        { OR: [{ publishEndAt: null }, { publishEndAt: { gte: now } }] },
      ],
      ...(opts.mallId !== undefined
        ? {
            OR: [{ mallId: opts.mallId }, { mallId: null }],
          }
        : {}),
      ...(opts.storeId ? { storeId: opts.storeId } : {}),
      ...(opts.search
        ? { title: { contains: opts.search, mode: 'insensitive' as const } }
        : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(opts.channel ? { channels: { has: opts.channel as any } } : {}),
    };

    return this.prisma.campaign.findMany({
      where,
      include: CAMPAIGN_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { campaignStartAt: 'asc' }],
    });
  }

  private buildListWhere(
    tenantId: string,
    mallId: string | undefined,
    query: ListCampaignsDto,
  ): Prisma.CampaignWhereInput {
    const mallScope: Prisma.CampaignWhereInput =
      mallId !== undefined
        ? {
            OR: [{ mallId }, { mallId: null }],
          }
        : {};

    return {
      tenantId,
      deletedAt: null,
      ...mallScope,
      ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' } }),
      ...(query.storeId ? { storeId: query.storeId } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
      ...(query.startFrom || query.startTo
        ? {
            campaignStartAt: {
              ...(query.startFrom ? { gte: new Date(query.startFrom) } : {}),
              ...(query.startTo ? { lte: new Date(query.startTo) } : {}),
            },
          }
        : {}),
      ...(query.endFrom || query.endTo
        ? {
            campaignEndAt: {
              ...(query.endFrom ? { gte: new Date(query.endFrom) } : {}),
              ...(query.endTo ? { lte: new Date(query.endTo) } : {}),
            },
          }
        : {}),
    };
  }

  private buildOrderBy(query: ListCampaignsDto): Prisma.CampaignOrderByWithRelationInput[] {
    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    const sortBy = query.sortBy ?? 'sortOrder';
    if (sortBy === 'campaignStartAt' || sortBy === 'startAt') {
      return [{ campaignStartAt: dir }, { sortOrder: 'asc' }];
    }
    if (sortBy === 'createdAt') {
      return [{ createdAt: dir }];
    }
    return [{ sortOrder: dir }, { createdAt: 'desc' }];
  }

  private assertMallVisibility(campaign: Campaign, mallId: string | undefined): void {
    if (mallId === undefined) return;
    if (campaign.mallId === null) return;
    if (campaign.mallId !== mallId) {
      throw new NotFoundException('Campaign not found');
    }
  }

  private async assertExists(id: string, tenantId: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async assertCoverMediaInScope(
    tenantId: string,
    mallId: string | null | undefined,
    coverMediaId: string,
  ): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: coverMediaId, tenantId, deletedAt: null },
    });
    if (!media) {
      throw new UnprocessableEntityException('Cover media not found for this tenant');
    }
    if (mallId) {
      if (media.mallId !== null && media.mallId !== mallId) {
        throw new UnprocessableEntityException(
          'Cover media must be tenant-wide or belong to the same mall as the campaign',
        );
      }
    }
  }

  private async assertMallStoreInScope(
    tenantId: string,
    campaignMallId: string | null | undefined,
    storeId: string,
  ): Promise<void> {
    const store = await this.prisma.mallStore.findFirst({
      where: { id: storeId, tenantId, deletedAt: null },
    });
    if (!store) {
      throw new BadRequestException('Mall store not found for this tenant');
    }
    if (campaignMallId && store.mallId !== campaignMallId) {
      throw new BadRequestException('storeId must belong to the same mall as the campaign');
    }
  }

  private async getDefaultLocaleId(tenantId: string): Promise<string | null> {
    const locale = await this.prisma.locale.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      select: { id: true },
    });
    return locale?.id ?? null;
  }

  private async upsertTranslations(
    campaignId: string,
    translations: CampaignTranslationDto[],
  ): Promise<void> {
    for (const tr of translations) {
      if (tr.coverImageId) {
        const campaign = await this.prisma.campaign.findUnique({
          where: { id: campaignId },
          select: { tenantId: true, mallId: true },
        });
        if (campaign) {
          await this.assertCoverMediaInScope(campaign.tenantId, campaign.mallId, tr.coverImageId);
        }
      }
      await this.prisma.campaignTranslation.upsert({
        where: {
          campaignId_localeId: { campaignId, localeId: tr.localeId },
        },
        create: {
          campaignId,
          localeId: tr.localeId,
          title: tr.title ?? null,
          description: tr.description ?? null,
          buttonText: tr.buttonText ?? null,
          coverImageId: tr.coverImageId ?? null,
        },
        update: {
          title: tr.title ?? null,
          description: tr.description ?? null,
          buttonText: tr.buttonText ?? null,
          coverImageId: tr.coverImageId ?? null,
        },
      });
    }
  }

  private async assertCoverMediaValid(opts: {
    tenantId: string;
    mallId: string | null | undefined;
    sameImageForAllLocales: boolean;
    sharedCoverImageId?: string | null;
    translations?: CampaignTranslationDto[];
    campaignId?: string;
    skipWhenDraft?: boolean;
  }): Promise<void> {
    if (opts.skipWhenDraft) return;

    if (opts.sameImageForAllLocales) {
      if (opts.sharedCoverImageId) {
        await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, opts.sharedCoverImageId);
      }
      return;
    }

    if (opts.translations?.some((t) => t.coverImageId)) {
      for (const tr of opts.translations) {
        if (tr.coverImageId) {
          await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, tr.coverImageId);
        }
      }
    }
  }

  private async assertPublishable(opts: {
    title: string;
    campaignStartAt: Date | null;
    tenantId: string;
    mallId: string | null | undefined;
    sameImageForAllLocales: boolean;
    sharedCoverImageId?: string;
    translations?: CampaignTranslationDto[];
    campaignId?: string;
    storeId?: string;
  }): Promise<void> {
    if (!opts.title?.trim()) {
      throw new UnprocessableEntityException('Title is required to publish');
    }
    if (!opts.campaignStartAt) {
      throw new UnprocessableEntityException('campaignStartAt is required to publish a campaign');
    }

    if (opts.sameImageForAllLocales) {
      if (!opts.sharedCoverImageId) {
        throw new UnprocessableEntityException(
          'sharedCoverImageId is required to publish a campaign when using shared images',
        );
      }
      await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, opts.sharedCoverImageId);
    } else {
      const defaultLocaleId = await this.getDefaultLocaleId(opts.tenantId);
      if (!defaultLocaleId) {
        throw new UnprocessableEntityException('Tenant default locale is not configured');
      }

      const fromPayload = opts.translations?.find((t) => t.localeId === defaultLocaleId);
      let defaultCoverId = fromPayload?.coverImageId ?? opts.sharedCoverImageId ?? null;

      if (!defaultCoverId && opts.campaignId) {
        const existingTr = await this.prisma.campaignTranslation.findUnique({
          where: {
            campaignId_localeId: { campaignId: opts.campaignId, localeId: defaultLocaleId },
          },
          select: { coverImageId: true },
        });
        defaultCoverId = existingTr?.coverImageId ?? opts.sharedCoverImageId ?? null;
      }

      if (!defaultCoverId) {
        throw new UnprocessableEntityException(
          'Default locale cover image is required to publish a campaign',
        );
      }
      await this.assertCoverMediaInScope(opts.tenantId, opts.mallId ?? null, defaultCoverId);
    }

    if (opts.storeId) {
      await this.assertMallStoreInScope(opts.tenantId, opts.mallId ?? null, opts.storeId);
    }
  }

  private toPrismaJson(
    v: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (v === undefined) return undefined;
    if (v === null) return Prisma.JsonNull;
    return v as Prisma.InputJsonValue;
  }
}
