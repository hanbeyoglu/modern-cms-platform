import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { MediaModule } from '../media/media.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantsController } from './tenants.controller';
import { SystemTenantsController } from './system-tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [AccessModule, AuditModule, PrismaModule, MediaModule],
  controllers: [TenantsController, SystemTenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
