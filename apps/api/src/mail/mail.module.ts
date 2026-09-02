import { Global, Module } from '@nestjs/common';

import { CredentialsMailService } from './credentials-mail.service';
import { InboundMailController } from './inbound/inbound-mail.controller';
import { InboundMailService } from './inbound/inbound-mail.service';
import { MailService } from './mail.service';
import { TicketMailService } from './ticket-mail.service';

/**
 * Correo, de salida y de entrada.
 *
 * Es global porque el envio lo consumen los modulos que lo provocan (tickets y
 * mensajes), igual que las notificaciones internas. Importarlo en cada uno
 * generaria dependencias cruzadas sin aportar nada.
 *
 * La recepcion, en cambio, no la consume nadie: entra por su propio webhook y
 * escribe directamente, porque un correo del cliente no pasa por las mismas
 * reglas que una accion de soporte (no marca la primera respuesta, no tiene
 * autor y puede reabrir un ticket resuelto).
 */
@Global()
@Module({
  controllers: [InboundMailController],
  providers: [MailService, TicketMailService, CredentialsMailService, InboundMailService],
  exports: [MailService, TicketMailService, CredentialsMailService],
})
export class MailModule {}
