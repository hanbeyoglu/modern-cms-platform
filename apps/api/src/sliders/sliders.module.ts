import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SlidersService } from './sliders.service';
import { SlidersController } from './sliders.controller';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [SlidersController],
  providers: [SlidersService],
  exports: [SlidersService],
})
export class SlidersModule {}
