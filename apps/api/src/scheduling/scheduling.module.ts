import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicModule } from '../public/public.module';
import { ContentPublishService } from './content-publish.service';
import { ContentSchedulingService } from './content-scheduling.service';

@Module({
  imports: [PrismaModule, AuditModule, PublicModule],
  providers: [ContentPublishService, ContentSchedulingService],
  exports: [ContentPublishService, ContentSchedulingService],
})
export class SchedulingModule {}
