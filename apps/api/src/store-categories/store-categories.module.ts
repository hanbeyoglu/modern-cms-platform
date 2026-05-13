import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { StoreCategoriesController } from './store-categories.controller';
import { StoreCategoriesService } from './store-categories.service';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [StoreCategoriesController],
  providers: [StoreCategoriesService],
  exports: [StoreCategoriesService],
})
export class StoreCategoriesModule {}
