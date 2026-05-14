import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { TranslationResolverModule } from '../translation-resolver/translation-resolver.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AccessModule, AuditModule, SearchModule, TranslationResolverModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
