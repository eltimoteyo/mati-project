import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

/**
 * WhatsApp (Twilio).
 *
 * Recibe mensajes del cliente via webhook, los encamina a un ticket y envia de
 * vuelta la respuesta generada por IA. `NotificationsModule` es global, asi
 * que no hace falta importarlo: basta con `AiModule` para que el servicio de IA
 * y sus dependencias (tickets, prisma) esten disponibles.
 */
@Module({
  imports: [AiModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
