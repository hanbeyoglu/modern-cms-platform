import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { MallLocalesModule } from '../mall-locales/mall-locales.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MallsController, LocationsController } from './malls.controller';
import { MallsService } from './malls.service';

@Module({
  imports: [AccessModule, AuditModule, PrismaModule, MallLocalesModule],
  controllers: [MallsController, LocationsController],
  providers: [MallsService],
  exports: [MallsService],
})
export class MallsModule {}
