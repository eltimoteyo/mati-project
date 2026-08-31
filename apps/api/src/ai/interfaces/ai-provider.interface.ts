/**
 * Contrato de los proveedores de IA — FASE POSTERIOR.
 *
 * Este archivo define unicamente la abstraccion sobre la que se implementaran
 * los proveedores (OpenRouter, Groq, Gemini) cuando llegue la fase de IA.
 * No hay implementaciones ni claves aqui a proposito: un proveedor simulado
 * seria codigo muerto y una clave en el repositorio, una fuga de seguridad.
 *
 * Estructura prevista (ver `src/ai/README.md`):
 *
 *   ai/
 *   ├── ai.module.ts
 *   ├── ai.service.ts
 *   ├── providers/
 *   │   ├── openrouter.provider.ts
 *   │   ├── groq.provider.ts
 *   │   └── gemini.provider.ts
 *   └── interfaces/
 *       └── ai-provider.interface.ts   <- este archivo
 */

/** Identificadores de los proveedores previstos. */
export const AI_PROVIDERS = {
  OPENROUTER: 'openrouter',
  GROQ: 'groq',
  GEMINI: 'gemini',
} as const;

export type AiProviderName = (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];

/** Rol de cada mensaje dentro de una conversacion con el modelo. */
export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiCompletionOptions {
  /** Identificador del modelo tal como lo nombra el proveedor. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Permite cancelar la peticion si el cliente abandona. */
  signal?: AbortSignal;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiCompletion {
  content: string;
  model: string;
  provider: AiProviderName;
  usage?: AiUsage;
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
