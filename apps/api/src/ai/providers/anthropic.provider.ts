import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/configuration';
import type {
  AiCompletion,
  AiCompletionOptions,
  AiMessage,
  AiProvider,
} from '../interfaces/ai-provider.interface';

/**
 * Tiempo maximo de una llamada. Con una senal del llamador (el turno del
 * agente), manda la del llamador y este tope solo evita una espera infinita.
 */
const CALL_TIMEOUT_MS = 60_000;
const CALL_TIMEOUT_WITH_SIGNAL_MS = 300_000;

/** Modelos anteriores que rechazan `output_config.effort`. */
const NO_EFFORT_MODELS = /^claude-(?:3|haiku-4|sonnet-4-5|opus-4-1|opus-4-0|sonnet-4-0)/;

/** Adaptador de Messages API. Los servicios de soporte no conocen el protocolo del proveedor. */
@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const;
  private readonly config: AppConfig['ai'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.config = config.get('ai', { infer: true });
  }

  isAvailable() {
    return this.config.enabled && this.config.provider === 'anthropic';
  }

  async complete(messages: AiMessage[], options: AiCompletionOptions = {}): Promise<AiCompletion> {
    if (!this.isAvailable()) throw new ServiceUnavailableException('Anthropic no está configurado');
    const converted: Array<{ role: string; content: unknown[] }> = [];
    for (const message of messages.filter((item) => item.role !== 'system')) {
      const role = message.role === 'assistant' ? 'assistant' : 'user';
      let content: unknown[] =
        message.role === 'tool'
          ? [{ type: 'tool_result', tool_use_id: message.toolCallId, content: message.content }]
          : [
              ...(message.content ? [{ type: 'text', text: message.content }] : []),
              ...(message.image
                ? [
                    {
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: message.image.mimeType,
                        data: message.image.data,
                      },
                    },
                  ]
                : []),
              ...(message.toolCalls ?? []).map((call) => ({
                type: 'tool_use',
                id: call.id,
                name: call.name,
                input: JSON.parse(call.arguments) as unknown,
              })),
            ];
      // Conserva firmas y bloques opacos de razonamiento que algunos modelos exigen al continuar.
      if (message.role === 'assistant' && message.providerContent)
        content = message.providerContent;
      const previous = converted.at(-1);
      if (previous?.role === role) previous.content.push(...content);
      else converted.push({ role, content });
    }
    const model = options.model ?? this.config.model;
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': this.config.anthropicVersion ?? '2026-10-21',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1400,
        // Los modelos actuales razonan por defecto y ese razonamiento cuenta en
        // `max_tokens`: el esfuerzo controla cuanto gastan antes de responder.
        ...(options.effort && !NO_EFFORT_MODELS.test(model)
          ? { output_config: { effort: options.effort } }
          : {}),
        system: messages
          .filter((item) => item.role === 'system')
          .map((item) => item.content)
          .join('\n'),
        messages: converted,
        ...(options.tools?.length
          ? {
              tools: options.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.parameters,
              })),
            }
          : {}),
      }),
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(CALL_TIMEOUT_WITH_SIGNAL_MS)])
        : AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(`Anthropic no disponible (HTTP ${response.status})`);
    const payload = (await response.json()) as {
      model: string;
      content: Array<{ type: string; text?: string; id: string; name: string; input: unknown }>;
      usage?: { input_tokens: number; output_tokens: number };
      stop_reason?: string;
    };
    if (payload.stop_reason === 'max_tokens')
      throw new ServiceUnavailableException('Respuesta de IA incompleta');
    const content = payload.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n');
    const toolCalls = payload.content
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({ id: block.id, name: block.name, arguments: JSON.stringify(block.input) }));
    if (
      (!content && !toolCalls.length) ||
      (!toolCalls.length && options.validate && !options.validate(content))
    )
      throw new ServiceUnavailableException('Respuesta de IA inválida');
    return {
      content,
      toolCalls,
      providerContent: payload.content,
      model: payload.model,
      provider: this.name,
      ...(payload.usage
        ? {
            usage: {
              promptTokens: payload.usage.input_tokens,
              completionTokens: payload.usage.output_tokens,
              totalTokens: payload.usage.input_tokens + payload.usage.output_tokens,
            },
          }
        : {}),
    };
  }
}
