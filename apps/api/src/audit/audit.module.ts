import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  providers: [
    AuditLogService,
    AuditInterceptor,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
