import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';
import { ContactMessagesController } from './contact-messages.controller';
import { ContactMessagesService } from './contact-messages.service';
import { ContactEmailQueueService } from './contact-email-queue.service';

@Module({
  imports: [PrismaModule, AccessModule],
  controllers: [ContactMessagesController],
  providers: [ContactMessagesService, ContactEmailQueueService],
  exports: [ContactMessagesService, ContactEmailQueueService],
})
export class ContactMessagesModule {}
