import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { MallStoresController } from './mall-stores.controller';
import { MallStoresService } from './mall-stores.service';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [MallStoresController],
  providers: [MallStoresService],
  exports: [MallStoresService],
})
export class MallStoresModule {}
