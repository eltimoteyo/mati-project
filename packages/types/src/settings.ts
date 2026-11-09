/**
 * Ajustes de automatizacion que se cambian desde el panel.
 *
 * Viven en base de datos y no en variables de entorno porque quien los
 * cambia es el equipo de soporte, no quien despliega.
 */
export interface AutomationSettings {
  /**
   * La IA contesta sola los WhatsApp entrantes mientras pueda resolver la
   * consulta; si no puede, crea el ticket y se retira de la conversacion.
   */
  whatsappAutoReply: boolean;
}

export type UpdateAutomationSettingsInput = Partial<AutomationSettings>;

/** Cuanto razona el modelo antes de responder. Solo lo aplica Claude (Anthropic). */
export const AI_EFFORT_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type AiEffort = (typeof AI_EFFORT_LEVELS)[keyof typeof AI_EFFORT_LEVELS];

export const AI_EFFORT_LABELS: Record<AiEffort, string> = {
  low: 'Bajo: rapido y barato',
  medium: 'Medio: equilibrado',
  high: 'Alto: mas lento y caro',
};

/**
 * Limites de la IA que se ajustan desde el panel.
 *
 * Lo que no se haya guardado toma el valor de las variables de entorno o, si
 * tampoco esta alli, el valor por defecto del servidor.
 */
export interface AiLimitsSettings {
  /** Razonamiento del agente de WhatsApp. */
  agentEffort: AiEffort;
  /** Razonamiento en tareas cortas: clasificar, resumir, leer capturas. */
  quickEffort: AiEffort;
  /** Tokens maximos de cada respuesta del agente, razonamiento incluido. */
  agentMaxTokens: number;
  /** Tokens minimos de cualquier respuesta; evita cortes cuando el modelo razona. */
  minResponseTokens: number;
  /** Tiempo maximo de un turno completo del agente, con sus herramientas. */
  turnTimeoutSeconds: number;
  /** Vueltas de herramientas que puede dar el agente en un turno. */
  maxToolRounds: number;
  /** Conversaciones que se atienden a la vez. */
  concurrentConversations: number;
  /** Espera tras el ultimo mensaje del cliente antes de responder. */
  replyDelaySeconds: number;
  /** Respuestas automaticas por conversacion y hora antes de pedir una persona. */
  maxRepliesPerHour: number;
  /** Gasto diario maximo en USD; 0 desactiva el limite. */
  dailyBudgetUsd: number;
  /** Precio por millon de tokens de entrada, en USD; sin precio no se calcula el gasto. */
  inputPriceUsdPerMillion: number | null;
  /** Precio por millon de tokens de salida, en USD. */
  outputPriceUsdPerMillion: number | null;
}

export type UpdateAiLimitsSettingsInput = Partial<AiLimitsSettings>;
