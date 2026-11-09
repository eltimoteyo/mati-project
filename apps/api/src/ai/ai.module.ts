import { forwardRef, Module } from '@nestjs/common';

import { TicketsModule } from '../tickets/tickets.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGateway } from './ai-gateway.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';

/**
 * Asistente de soporte.
 *
 * El gateway selecciona Anthropic directo u OpenRouter. El flujo de soporte
 * comparte mensajes y herramientas sin depender del protocolo del proveedor.
 */
@Module({
  imports: [forwardRef(() => TicketsModule)],
  controllers: [AiController],
  providers: [OpenRouterProvider, AnthropicProvider, AiGateway, AiService],
  exports: [AiService, AiGateway],
})
export class AiModule {}
