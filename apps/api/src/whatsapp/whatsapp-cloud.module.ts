import { Global, Module } from '@nestjs/common';

import { TicketWhatsappService } from './ticket-whatsapp.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';

/**
 * WhatsApp de salida (Meta Cloud API).
 *
 * Es global por el mismo motivo que el correo: el aviso lo consume el modulo
 * que lo provoca (tickets). Va aparte de `WhatsappModule` —la recepcion por
 * Twilio— porque aquel depende de la IA, y esta a su vez de tickets:
 * importarlo desde tickets cerraria un ciclo.
 */
@Global()
@Module({
  providers: [WhatsappCloudService, TicketWhatsappService],
  exports: [WhatsappCloudService, TicketWhatsappService],
})
export class WhatsappCloudModule {}
