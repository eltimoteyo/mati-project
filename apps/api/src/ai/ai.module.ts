import { Module } from '@nestjs/common';

import { TicketsModule } from '../tickets/tickets.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenRouterProvider } from './providers/openrouter.provider';

/**
 * Asistente de soporte.
 *
 * Solo se registra OpenRouter: su API es compatible con la de OpenAI y da
 * acceso a modelos de varios fabricantes cambiando una variable de entorno,
 * asi que anadir un segundo proveedor ahora seria codigo sin uso. La interfaz
 * `AiProvider` deja la puerta abierta a hacerlo cuando haga falta de verdad.
 */
@Module({
  imports: [TicketsModule],
  controllers: [AiController],
  providers: [OpenRouterProvider, AiService],
  exports: [AiService],
})
export class AiModule {}
