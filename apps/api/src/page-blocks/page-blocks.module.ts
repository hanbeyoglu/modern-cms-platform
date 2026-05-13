import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { PageBlocksController } from './page-blocks.controller';
import { PageBlocksService } from './page-blocks.service';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [PageBlocksController],
  providers: [PageBlocksService],
  exports: [PageBlocksService],
})
export class PageBlocksModule {}
