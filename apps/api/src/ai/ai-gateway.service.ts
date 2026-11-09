import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { SettingsService } from '../settings/settings.service';
import type { AiCompletionOptions, AiMessage } from './interfaces/ai-provider.interface';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';

@Injectable()
export class AiGateway {
  private readonly config: AppConfig['ai'];
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly openrouter: OpenRouterProvider,
    private readonly anthropic: AnthropicProvider,
    // Opcional para los scripts que construyen el gateway sin Nest.
    @Optional() private readonly settings?: SettingsService,
  ) {
    this.config = config.get('ai', { infer: true });
  }
  isAvailable() {
    return this.config.enabled;
  }
  async complete(messages: AiMessage[], options: AiCompletionOptions = {}) {
    if (this.config.provider !== 'anthropic') return this.openrouter.complete(messages, options);

    // Con Claude, los limites del panel: un esfuerzo por defecto para las
    // tareas cortas y un minimo de tokens para que el razonamiento no deje la
    // respuesta a medias. Solo se cobra lo que el modelo usa.
    const limits = await this.settings?.getAiLimits();

    return this.anthropic.complete(messages, {
      ...options,
      effort: options.effort ?? limits?.quickEffort,
      maxTokens: Math.max(options.maxTokens ?? 0, limits?.minResponseTokens ?? 0) || undefined,
    });
  }
}
