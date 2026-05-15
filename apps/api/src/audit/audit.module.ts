import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditController } from './audit.controller';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [AccessModule],
  controllers: [AuditController],
  providers: [
    AuditLogService,
    AuditInterceptor,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
