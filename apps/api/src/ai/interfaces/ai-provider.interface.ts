/** Contrato común de texto, imágenes y herramientas para los proveedores de IA. */

/** Identificadores de proveedores. */
export const AI_PROVIDERS = {
  OPENROUTER: 'openrouter',
  GROQ: 'groq',
  GEMINI: 'gemini',
  ANTHROPIC: 'anthropic',
} as const;

export type AiProviderName = (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];

/** Rol de cada mensaje dentro de una conversacion con el modelo. */
export type AiMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiMessage {
  role: AiMessageRole;
  content: string;
  toolCalls?: AiToolCall[];
  toolCallId?: string;
  image?: { mimeType: string; data: string };
  providerContent?: unknown[];
  reasoningDetails?: unknown[];
}

export interface AiCompletionOptions {
  /** Identificador del modelo tal como lo nombra el proveedor. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Permite cancelar la peticion si el cliente abandona. */
  signal?: AbortSignal;
  /**
   * Comprueba si la respuesta sirve.
   *
   * Cuando devuelve `false`, el proveedor considera el intento fallido y prueba
   * con el siguiente modelo. Es lo que permite exigir JSON valido sin que cada
   * modulo tenga que conocer la lista de modelos ni reintentar por su cuenta.
   */
  validate?: (content: string) => boolean;
  tools?: AiTool[];
  /**
   * Cuanto razona el modelo antes de responder. Solo lo aplica Anthropic; el
   * resto de proveedores lo ignora.
   */
  effort?: 'low' | 'medium' | 'high';
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface AiCompletion {
  content: string;
  model: string;
  provider: AiProviderName;
  usage?: AiUsage;
  toolCalls?: AiToolCall[];
  providerContent?: unknown[];
  reasoningDetails?: unknown[];
}

/**
 * Interfaz que implementara cada proveedor.
 *
 * Mantenerla estrecha permite que `AiService` cambie de proveedor (por coste,
 * latencia o disponibilidad) sin que los modulos de dominio se enteren.
 */
export interface AiProvider {
  readonly name: AiProviderName;

  /** Indica si el proveedor esta configurado y puede atender peticiones. */
  isAvailable(): boolean;

  /** Genera una respuesta a partir del historial de mensajes. */
  complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<AiCompletion>;
}

/** Token de inyeccion para registrar los proveedores disponibles. */
export const AI_PROVIDER_TOKEN = Symbol('AI_PROVIDER');
