import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { TicketsModule } from '../tickets/tickets.module';
import { WhatsappMediaService } from '../whatsapp/whatsapp-media.service';
import { IdentityService } from './agent/identity.service';
import { SupportAdminController } from './agent/support-admin.controller';
import { SupportAgentService } from './agent/support-agent.service';
import { SupportCasesService } from './agent/support-cases.service';
import { SupportDiagnosticsService } from './agent/support-diagnostics.service';
import { SupportKnowledgeService } from './agent/support-knowledge.service';
import { SupportMaintenanceService } from './agent/support-maintenance.service';
import { SupportToolsService } from './agent/support-tools.service';
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
  controllers: [InboxController, MetaWebhookController, SupportAdminController],
  providers: [
    InboxService,
    InboxAutoReplyService,
    IdentityService,
    SupportAgentService,
    SupportCasesService,
    SupportDiagnosticsService,
    SupportKnowledgeService,
    SupportToolsService,
    WhatsappMediaService,
    SupportMaintenanceService,
  ],
})
export class InboxModule {}
