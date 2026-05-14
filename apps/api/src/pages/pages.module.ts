import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [AccessModule, AuditModule, SearchModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
