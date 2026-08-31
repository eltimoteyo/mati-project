import { Module } from '@nestjs/common';

import { TicketsModule } from '../tickets/tickets.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

/**
 * Conversaciones de los tickets.
 * Depende de `TicketsModule` para resolver el ticket a partir de su codigo.
 */
@Module({
  imports: [TicketsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
