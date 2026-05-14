import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { CapabilitiesService } from './capabilities.service';
import { CapabilitiesController } from './capabilities.controller';

@Module({
  imports: [PrismaModule, AccessModule],
  providers: [CapabilitiesService],
  controllers: [CapabilitiesController],
  exports: [CapabilitiesService],
})
export class CapabilitiesModule {}
