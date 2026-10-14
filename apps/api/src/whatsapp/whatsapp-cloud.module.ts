import { Global, Module } from '@nestjs/common';

import { TicketWhatsappService } from './ticket-whatsapp.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { WhatsappConversationsService } from './whatsapp-conversations.service';

/**
 * WhatsApp por la Cloud API de Meta: envio y registro de conversaciones.
 *
 * Es global por el mismo motivo que el correo: el aviso lo consume el modulo
 * que lo provoca (tickets). Va aparte de `WhatsappModule` —la recepcion por
 * Twilio— porque aquel depende de la IA, y esta a su vez de tickets:
 * importarlo desde tickets cerraria un ciclo.
 */
@Global()
@Module({
  providers: [WhatsappCloudService, WhatsappConversationsService, TicketWhatsappService],
  exports: [WhatsappCloudService, WhatsappConversationsService, TicketWhatsappService],
})
export class WhatsappCloudModule {}
