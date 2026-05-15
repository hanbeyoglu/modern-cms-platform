import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { PopupsService } from './popups.service';
import { PopupsController } from './popups.controller';

@Module({
  imports: [AccessModule, AuditModule, SearchModule],
  controllers: [PopupsController],
  providers: [PopupsService],
  exports: [PopupsService],
})
export class PopupsModule {}
