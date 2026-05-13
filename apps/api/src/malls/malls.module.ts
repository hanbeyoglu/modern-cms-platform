import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { MallsController } from './malls.controller';
import { MallsService } from './malls.service';

@Module({
  imports: [AccessModule],
  controllers: [MallsController],
  providers: [MallsService],
})
export class MallsModule {}
