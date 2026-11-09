import {
  AI_EFFORT_LEVELS,
  type AiEffort,
  type AiLimitsSettings,
  type AutomationSettings,
  type UpdateAiLimitsSettingsInput,
  type UpdateAutomationSettingsInput,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';

const AUTOMATION_KEY = 'automation';
const AI_LIMITS_KEY = 'ai-limits';

/**
 * Precios publicados de Anthropic, en USD por millon de tokens (entrada, salida).
 *
 * Solo sirven de valor inicial para que el presupuesto diario funcione sin
 * configurar nada; el panel permite corregirlos si cambian.
 */
const ANTHROPIC_PRICES: Record<string, [number, number]> = {
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-opus-5-5': [4, 20],
};

/**
 * Limites de la IA sin configurar.
 *
 * El razonamiento medio y los 4000 tokens dan margen a Claude para pensar y
 * contestar sin que la respuesta se corte; 90 s cubren varias herramientas.
 */
const DEFAULT_AI_LIMITS: Omit<
  AiLimitsSettings,
  'dailyBudgetUsd' | 'inputPriceUsdPerMillion' | 'outputPriceUsdPerMillion'
> = {
  agentEffort: AI_EFFORT_LEVELS.MEDIUM,
  quickEffort: AI_EFFORT_LEVELS.LOW,
  agentMaxTokens: 4000,
  minResponseTokens: 3000,
  turnTimeoutSeconds: 90,
  maxToolRounds: 5,
  concurrentConversations: 3,
  replyDelaySeconds: 6,
  maxRepliesPerHour: 10,
};

const LIMIT_RULES = VALIDATION_RULES.aiLimits;

/**
 * Valores por defecto.
 *
 * La respuesta automatica nace apagada: que una IA empiece a contestar a los
 * clientes debe ser una decision de alguien, no un efecto de desplegar.
 */
const DEFAULT_AUTOMATION: AutomationSettings = {
  whatsappAutoReply: false,
};

/**
 * Ajustes que se cambian desde el panel.
 *
 * Se guardan como JSON por clave y se leen siempre a traves de este servicio,
 * que completa lo que falte con los valores por defecto: un ajuste nuevo no
 * necesita migrar las filas existentes.
 */
@Injectable()
export class SettingsService {
  private readonly ai: AppConfig['ai'];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.ai = config.get('ai', { infer: true });
  }

  async getAutomation(): Promise<AutomationSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: AUTOMATION_KEY } });
    const stored =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {};

    return {
      whatsappAutoReply:
        typeof stored['whatsappAutoReply'] === 'boolean'
          ? stored['whatsappAutoReply']
          : DEFAULT_AUTOMATION.whatsappAutoReply,
    };
  }

  async updateAutomation(input: UpdateAutomationSettingsInput): Promise<AutomationSettings> {
    const next: AutomationSettings = { ...(await this.getAutomation()), ...input };

    await this.prisma.appSetting.upsert({
      where: { key: AUTOMATION_KEY },
      create: { key: AUTOMATION_KEY, value: { ...next } },
      update: { value: { ...next } },
    });

    return next;
  }

  /**
   * Limites de la IA.
   *
   * Un valor guardado fuera de rango (por ejemplo, si cambian las reglas) se
   * ignora y se usa el valor por defecto, en lugar de romper la respuesta.
   */
  async getAiLimits(): Promise<AiLimitsSettings> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: AI_LIMITS_KEY } });
    const stored: Record<string, unknown> =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    const defaults = this.aiLimitDefaults();
    const effort = (key: 'agentEffort' | 'quickEffort'): AiEffort => {
      const value = stored[key];

      return (Object.values(AI_EFFORT_LEVELS) as unknown[]).includes(value)
        ? (value as AiEffort)
        : defaults[key];
    };
    const number = (key: keyof typeof LIMIT_RULES & keyof AiLimitsSettings): number => {
      const value = stored[key];
      const range = LIMIT_RULES[key];

      return typeof value === 'number' && value >= range.min && value <= range.max
        ? value
        : (defaults[key] as number);
    };
    const price = (key: 'inputPriceUsdPerMillion' | 'outputPriceUsdPerMillion'): number | null => {
      const value = stored[key];

      if (value === null) return null;

      return typeof value === 'number' &&
        value >= LIMIT_RULES.priceUsdPerMillion.min &&
        value <= LIMIT_RULES.priceUsdPerMillion.max
        ? value
        : defaults[key];
    };

    return {
      agentEffort: effort('agentEffort'),
      quickEffort: effort('quickEffort'),
      agentMaxTokens: number('agentMaxTokens'),
      minResponseTokens: number('minResponseTokens'),
      turnTimeoutSeconds: number('turnTimeoutSeconds'),
      maxToolRounds: number('maxToolRounds'),
      concurrentConversations: number('concurrentConversations'),
      replyDelaySeconds: number('replyDelaySeconds'),
      maxRepliesPerHour: number('maxRepliesPerHour'),
      dailyBudgetUsd: number('dailyBudgetUsd'),
      inputPriceUsdPerMillion: price('inputPriceUsdPerMillion'),
      outputPriceUsdPerMillion: price('outputPriceUsdPerMillion'),
    };
  }

  async updateAiLimits(input: UpdateAiLimitsSettingsInput): Promise<AiLimitsSettings> {
    // Los campos no enviados pueden llegar como `undefined` en la instancia del
    // DTO; sin este filtro borrarian el valor guardado.
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as UpdateAiLimitsSettingsInput;
    const next: AiLimitsSettings = { ...(await this.getAiLimits()), ...changes };

    await this.prisma.appSetting.upsert({
      where: { key: AI_LIMITS_KEY },
      create: { key: AI_LIMITS_KEY, value: { ...next } },
      update: { value: { ...next } },
    });

    return next;
  }

  /** Valores por defecto: las variables de entorno mandan sobre las constantes. */
  private aiLimitDefaults(): AiLimitsSettings {
    const known =
      this.ai.provider === 'anthropic' ? ANTHROPIC_PRICES[this.ai.agentModel ?? ''] : undefined;

    return {
      ...DEFAULT_AI_LIMITS,
      dailyBudgetUsd: this.ai.dailyBudget,
      inputPriceUsdPerMillion: this.ai.inputPrice ?? known?.[0] ?? null,
      outputPriceUsdPerMillion: this.ai.outputPrice ?? known?.[1] ?? null,
    };
  }
}
