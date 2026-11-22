import { Module } from '@nestjs/common';
import { PublicModule } from '../public/public.module';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { SlidersService } from './sliders.service';
import { SlidersController } from './sliders.controller';

@Module({
  imports: [AccessModule, AuditModule, SearchModule, PublicModule],
  controllers: [SlidersController],
  providers: [SlidersService],
  exports: [SlidersService],
})
export class SlidersModule {}
