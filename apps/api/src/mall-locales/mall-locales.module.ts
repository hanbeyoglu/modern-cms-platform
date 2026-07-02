import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MallLocalesService } from './mall-locales.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [MallLocalesService],
  exports: [MallLocalesService],
})
export class MallLocalesModule {}
