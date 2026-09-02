import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import {
  AI_PROVIDERS,
  type AiCompletion,
  type AiCompletionOptions,
  type AiMessage,
  type AiProvider,
  type AiProviderName,
} from '../interfaces/ai-provider.interface';

/** Tiempo maximo de espera: el panel no puede quedarse colgado por el modelo. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Forma de la respuesta de OpenRouter que realmente se consume. */
interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

/**
 * Proveedor de IA sobre OpenRouter.
 *
 * OpenRouter expone una API compatible con la de OpenAI, lo que permite
 * cambiar de modelo con una variable de entorno sin tocar codigo.
 *
 * La clave se lee de la configuracion validada, nunca de `process.env` ni del
 * repositorio, y no aparece en ningun registro: si la peticion falla, se anota
 * el motivo pero jamas la credencial.
 */
@Injectable()
export class OpenRouterProvider implements AiProvider {
  readonly name: AiProviderName = AI_PROVIDERS.OPENROUTER;

  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly config: AppConfig['ai'];
  private readonly appUrl: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.config = configService.get('ai', { infer: true });
    this.appUrl = configService.get('cors', { infer: true }).frontendUrl;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  /**
   * Genera una respuesta probando los modelos en orden.
   *
   * Los modelos gratuitos de OpenRouter comparten cupo entre todos sus
   * usuarios y devuelven 429 con frecuencia. Al primer rechazo por saturacion
   * o por modelo inexistente se pasa al siguiente de la lista; los demas
   * errores se propagan, porque reintentar con otro modelo no los arreglaria.
   */
  async complete(messages: AiMessage[], options: AiCompletionOptions = {}): Promise<AiCompletion> {
    if (!this.config.apiKey) {
      throw new ServiceUnavailableException(
        'El asistente de IA no esta configurado en este entorno',
      );
    }

    // Si quien llama pide un modelo concreto se respeta y no se sustituye.
    const chain = options.model ? [options.model] : [this.config.model, ...this.config.fallbackModels];

    let lastReason = 'sin detalle';

    for (const candidate of chain) {
      const result = await this.attempt(candidate, messages, options);

      if (result.ok) return result.completion;

      lastReason = result.reason;

      if (!result.retryable) break;

      this.logger.warn(`${candidate} no disponible (${result.reason}); probando el siguiente modelo`);
    }

    throw new ServiceUnavailableException(
      `El asistente no esta disponible en este momento (${lastReason}). Intentalo de nuevo en unos minutos.`,
    );
  }

  /** Un intento contra un modelo concreto. Nunca lanza: informa del resultado. */
  private async attempt(
    model: string,
    messages: AiMessage[],
    options: AiCompletionOptions,
  ): Promise<
    | { ok: true; completion: AiCompletion }
    | { ok: false; retryable: boolean; reason: string }
  > {

    // Se combina el temporizador propio con la senal de quien llama para que la
    // peticion se corte tanto si tarda demasiado como si el cliente se va.
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    let response: Response;

    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          // OpenRouter usa estas dos cabeceras para atribuir el consumo.
          'HTTP-Referer': this.appUrl,
          'X-Title': 'CONIT Support',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 700,
        }),
        signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'desconocido';

      // Un fallo de red o un tiempo agotado no mejoran cambiando de modelo.
      return { ok: false, retryable: false, reason: `sin respuesta: ${reason}` };
    }

    const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;

    if (!response.ok || !payload) {
      const detail = payload?.error?.message ?? `HTTP ${response.status}`;

      // 429: cupo agotado. 404: el modelo ya no existe. En ambos casos otro
      // modelo de la lista puede atender la peticion.
      const retryable = response.status === 429 || response.status === 404;

      if (!retryable) {
        // El mensaje del proveedor se registra pero no se propaga al usuario:
        // puede incluir detalles internos que no le corresponden ver.
        this.logger.warn(`OpenRouter devolvio ${response.status}: ${detail}`);
      }

      return {
        ok: false,
        retryable,
        reason: response.status === 429 ? 'servicio saturado' : `error ${response.status}`,
      };
    }

    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return { ok: false, retryable: true, reason: 'respuesta vacia' };
    }

    // Un modelo puede responder rapido y en el formato equivocado; para quien
    // llamo eso es tan inservible como un error, asi que cuenta como fallo.
    if (options.validate && !options.validate(content)) {
      return { ok: false, retryable: true, reason: 'formato inesperado' };
    }

    const completion: AiCompletion = {
      content,
      model: payload.model ?? model,
      provider: this.name,
      ...(payload.usage
        ? {
            usage: {
              promptTokens: payload.usage.prompt_tokens ?? 0,
              completionTokens: payload.usage.completion_tokens ?? 0,
              totalTokens: payload.usage.total_tokens ?? 0,
            },
          }
        : {}),
    };

    return { ok: true, completion };
  }
}
