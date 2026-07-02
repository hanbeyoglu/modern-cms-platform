import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { ScreeningHallsController } from './screening-halls.controller';
import { ScreeningHallsService } from './screening-halls.service';

@Module({
  imports: [AccessModule, AuditModule],
  controllers: [ScreeningHallsController],
  providers: [ScreeningHallsService],
  exports: [ScreeningHallsService],
})
export class ScreeningHallsModule {}
