import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { MovieSessionsByMovieController } from './movie-sessions-by-movie.controller';
import { MovieSessionsController } from './movie-sessions.controller';
import { MovieSessionsService } from './movie-sessions.service';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [MovieSessionsController, MovieSessionsByMovieController],
  providers: [MovieSessionsService],
  exports: [MovieSessionsService],
})
export class MovieSessionsModule {}
