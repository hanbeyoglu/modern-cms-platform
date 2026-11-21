import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ContactMessageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginationMeta } from '../public/public-response.types';
import { CreateContactMessageDto, ListContactMessagesDto } from './dto/contact-message.dto';
import { ContactEmailQueueService } from './contact-email-queue.service';

@Injectable()
export class ContactMessagesService {
  private readonly logger = new Logger(ContactMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailQueue: ContactEmailQueueService,
  ) {}

  async scope(tenantId?: string, mallId?: string) {
    if (!tenantId || !mallId) throw new BadRequestException('Tenant ve AVM seçimi gerekli.');
    const mall = await this.prisma.mall.findFirst({
      where: { id: mallId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!mall) throw new NotFoundException('AVM bulunamadı.');
    return { tenantId, mallId };
  }

  async submit(scope: { tenantId: string; mallId: string }, dto: CreateContactMessageDto) {
    if (dto.website?.trim()) throw new BadRequestException('Mesaj gönderilemedi.');
    if (dto.kvkkConsent !== true) throw new BadRequestException('KVKK onayı gerekli.');

    let created: { id: string; emailNotificationStatus: string };
    try {
      const mall = await this.prisma.mall.findFirst({
        where: { id: scope.mallId, tenantId: scope.tenantId, deletedAt: null },
        select: { id: true, supportEmail: true },
      });
      if (!mall) throw new NotFoundException('AVM bulunamadı.');

      const supportEmail = mall.supportEmail?.trim() || '';
      const emailNotificationStatus = supportEmail ? 'PENDING' : 'SKIPPED';

      created = await this.prisma.contactMessage.create({
        data: {
          ...scope,
          name: dto.name,
          email: dto.email,
          phone: dto.phone || null,
          subject: dto.subject || null,
          message: dto.message,
          kvkkConsent: true,
          kvkkConsentAt: new Date(),
          emailNotificationStatus,
        },
        select: { id: true, emailNotificationStatus: true },
      });
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      // Prisma diagnostics may include input values. Do not propagate or log visitor data.
      throw new ServiceUnavailableException('Mesajınız şu anda alınamıyor. Lütfen tekrar deneyin.');
    }

    if (created.emailNotificationStatus === 'PENDING') {
      try {
        await this.emailQueue.enqueueNotification({
          messageId: created.id,
          tenantId: scope.tenantId,
          mallId: scope.mallId,
        });
      } catch {
        // Message is persisted; worker outbox recovery will re-enqueue PENDING rows.
        this.logger.warn(`Contact email enqueue failed messageId=${created.id}`);
      }
    }

    return { accepted: true as const };
  }

  async list(
    tenantId: string | undefined,
    mallId: string | undefined,
    query: ListContactMessagesDto,
  ) {
    const scope = await this.scope(tenantId, mallId);
    const from = query.from ? new Date(query.from) : undefined;
    // A date-only upper bound includes the entire selected UTC day.
    const to = query.to ? new Date(query.to) : undefined;
    const dateOnlyTo = query.to?.length === 10;
    if (to && dateOnlyTo) to.setUTCDate(to.getUTCDate() + 1);
    if (from && to && from > to) throw new BadRequestException('Tarih aralığı geçersiz.');
    const where: Prisma.ContactMessageWhereInput = {
      ...scope,
      ...(query.status && { status: query.status }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && (dateOnlyTo ? { lt: to } : { lte: to })),
        },
      }),
      ...(query.search && {
        OR: ['name', 'email', 'subject', 'message'].map((field) => ({
          [field]: { contains: query.search, mode: 'insensitive' },
        })),
      }),
    };
    const page = query.page ?? 1,
      limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        select: { id: true, name: true, email: true, subject: true, status: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contactMessage.count({ where }),
    ]);
    return { items, pagination: buildPaginationMeta(page, limit, total) };
  }

  async unreadCount(tenantId?: string, mallId?: string) {
    const scope = await this.scope(tenantId, mallId);
    return {
      count: await this.prisma.contactMessage.count({ where: { ...scope, status: 'NEW' } }),
    };
  }

  async detail(tenantId: string | undefined, mallId: string | undefined, id: string) {
    const scope = await this.scope(tenantId, mallId);
    await this.prisma.contactMessage.updateMany({
      where: { ...scope, id, status: 'NEW' },
      data: { status: 'READ', readAt: new Date() },
    });
    const row = await this.prisma.contactMessage.findFirst({ where: { ...scope, id } });
    if (!row) throw new NotFoundException('Mesaj bulunamadı.');
    return row;
  }

  async updateStatus(
    tenantId: string | undefined,
    mallId: string | undefined,
    id: string,
    status: ContactMessageStatus,
  ) {
    const scope = await this.scope(tenantId, mallId);
    const row = await this.prisma.contactMessage.findFirst({ where: { ...scope, id } });
    if (!row) throw new NotFoundException('Mesaj bulunamadı.');
    await this.prisma.contactMessage.updateMany({
      where: { ...scope, id },
      data: {
        status,
        readAt:
          status === 'NEW' ? null : status === 'READ' ? (row.readAt ?? new Date()) : row.readAt,
        archivedAt: status === 'ARCHIVED' ? (row.archivedAt ?? new Date()) : null,
      },
    });
    return this.prisma.contactMessage.findFirstOrThrow({ where: { ...scope, id } });
  }
}
