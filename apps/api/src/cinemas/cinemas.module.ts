import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { CinemasController } from './cinemas.controller';
import { CinemasService } from './cinemas.service';

@Module({
  imports: [AccessModule, AuditModule, SearchModule],
  controllers: [CinemasController],
  providers: [CinemasService],
  exports: [CinemasService],
})
export class CinemasModule {}
