import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';

@Module({
  imports: [AccessModule, AuditModule, SearchModule],
  controllers: [MoviesController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
