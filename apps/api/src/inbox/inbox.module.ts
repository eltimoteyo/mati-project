import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { TicketsModule } from '../tickets/tickets.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { InboxAutoReplyService } from './inbox-autoreply.service';
import { MetaWebhookController } from './meta-webhook.controller';

/**
 * Bandeja de WhatsApp: webhook de Meta y endpoints del panel.
 *
 * El registro de conversaciones y el envio viven en `WhatsappCloudModule`
 * (global), porque tambien los usan los avisos de tickets.
 */
@Module({
  imports: [TicketsModule, AiModule],
  controllers: [InboxController, MetaWebhookController],
  providers: [InboxService, InboxAutoReplyService],
})
export class InboxModule {}
