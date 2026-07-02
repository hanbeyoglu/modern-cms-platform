import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { MallFloorsController } from './mall-floors.controller';
import { MallFloorsService } from './mall-floors.service';

@Module({
  imports: [AccessModule],
  controllers: [MallFloorsController],
  providers: [MallFloorsService],
  exports: [MallFloorsService],
})
export class MallFloorsModule {}
