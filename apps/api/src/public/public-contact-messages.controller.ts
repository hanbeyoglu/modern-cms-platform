import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Header,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import {
  ApiLocaleQuery,
  ApiPublicContext,
  ApiPublicOperation,
} from '../swagger/swagger.decorators';
import { CreateContactMessageDto } from '../contact-messages/dto/contact-message.dto';
import { ContactMessagesService } from '../contact-messages/contact-messages.service';
import { PublicContextService } from './public-context.service';
import { makeEnvelope } from './public-response.types';
import { PublicApiKeyGuard } from './guards/public-api-key.guard';
import { ContactRateLimitGuard } from './guards/contact-rate-limit.guard';

@Public()
@ApiTags('İletişim Mesajları')
@ApiSecurity('apiKey')
@ApiPublicContext()
@UseGuards(PublicApiKeyGuard, ContactRateLimitGuard)
@Controller('public/contact-messages')
export class PublicContactMessagesController {
  constructor(
    private readonly ctx: PublicContextService,
    private readonly messages: ContactMessagesService,
  ) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiPublicOperation({
    summary: 'Send a contact message',
    description:
      'Stores a message with required KVKK consent. Scope comes from the API key and validated mall header; no message reads are exposed. Maximum 5 submissions per IP, tenant and mall per 10 minutes.',
    mallRequired: true,
  })
  @ApiLocaleQuery()
  @ApiResponse({ status: 201, description: 'Message accepted. Envelope data: { accepted: true }.' })
  @ApiResponse({ status: 429, description: 'Submission rate limit reached.' })
  async submit(
    @Req() req: Request,
    @Body() dto: CreateContactMessageDto,
    @Query('locale') locale?: string,
  ) {
    const headerTenant = req.header('x-tenant-id');
    if (headerTenant && headerTenant.trim() !== req.tenantId)
      throw new ForbiddenException('Tenant bağlamı geçersiz.');
    const context = await this.ctx.resolve(req.tenantId, req.mallId, locale);
    if (!context.mallId) throw new BadRequestException('AVM seçimi gerekli.');
    const data = await this.messages.submit(
      { tenantId: context.tenantId, mallId: context.mallId },
      dto,
    );
    return makeEnvelope(data, {
      tenantId: context.tenantId,
      mallId: context.mallId,
      locale: context.locale?.code ?? null,
    });
  }
}
