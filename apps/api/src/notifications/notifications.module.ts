import { Global, Module } from '@nestjs/common';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Modulo de avisos.
 *
 * Es global porque lo consumen los modulos que provocan los eventos (tickets,
 * mensajes). La alternativa —importarlo en cada uno— crearia dependencias
 * circulares en cuanto notificaciones necesitase leer un ticket.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
