import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { PublicModule } from '../public/public.module';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';

@Module({
  imports: [AccessModule, AuditModule, SearchModule, PublicModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class LocationServicesModule {}
