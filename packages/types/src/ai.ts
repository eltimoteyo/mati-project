import type { TicketPriority } from './ticket';

/* -----------------------------------------------------------------------------
 * Asistente de soporte
 * -------------------------------------------------------------------------- */

/**
 * Estado del asistente.
 *
 * La interfaz lo consulta antes de ofrecer nada: si no hay proveedor
 * configurado, no se muestran botones que fueran a fallar al pulsarlos.
 */
export interface AiStatus {
  enabled: boolean;
  /** Modelo activo. `null` cuando el asistente no esta configurado. */
  model: string | null;
}

export const AI_REPLY_TONES = {
  NEUTRAL: 'NEUTRAL',
  EMPATHETIC: 'EMPATHETIC',
  TECHNICAL: 'TECHNICAL',
} as const;

export type AiReplyTone = (typeof AI_REPLY_TONES)[keyof typeof AI_REPLY_TONES];

export const AI_REPLY_TONE_LABELS: Record<AiReplyTone, string> = {
  NEUTRAL: 'Neutro y profesional',
  EMPATHETIC: 'Cercano y empatico',
  TECHNICAL: 'Tecnico y detallado',
};

export interface AiSuggestReplyInput {
  tone?: AiReplyTone;
  /** Indicaciones concretas para esta respuesta. */
  instructions?: string;
}

export interface AiSuggestion {
  /** Texto propuesto, listo para revisar antes de enviarlo. */
  content: string;
  model: string;
}

/** Clasificacion propuesta para un ticket. */
export interface AiClassification {
  /** Categoria sugerida de entre las existentes. `null` si ninguna encaja. */
  categoryId: string | null;
  categoryName: string | null;
  priority: TicketPriority;
  /** Por que se propone esa clasificacion, en una frase. */
  reasoning: string;
  model: string;
}

export interface AiSummary {
  /** Resumen del caso en unas pocas frases. */
  summary: string;
  /** Proximos pasos sugeridos. */
  nextSteps: string[];
  model: string;
}
