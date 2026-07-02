import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { DeveloperApiController } from './developer-api.controller';
import { DeveloperApiService } from './developer-api.service';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [DeveloperApiController],
  providers: [DeveloperApiService],
  exports: [DeveloperApiService],
})
export class DeveloperApiModule {}
