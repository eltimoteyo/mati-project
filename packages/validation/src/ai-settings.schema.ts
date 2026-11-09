import { AI_EFFORT_LEVELS } from '@conit/types';
import { z } from 'zod';

import { VALIDATION_RULES } from './rules';
import { enumFrom } from './shared';

const rules = VALIDATION_RULES.aiLimits;

/** Numero entero dentro de un rango, escrito en un campo de texto. */
const wholeNumber = (label: string, range: { min: number; max: number }) =>
  z.coerce
    .number({ message: `${label} debe ser un numero.` })
    .int({ message: `${label} debe ser un numero entero.` })
    .min(range.min, { message: `${label} debe estar entre ${range.min} y ${range.max}.` })
    .max(range.max, { message: `${label} debe estar entre ${range.min} y ${range.max}.` });

/** Precio opcional; vacio significa "sin precio", y entonces no se calcula el gasto. */
const optionalPrice = (label: string) =>
  z
    .union([z.literal(''), z.coerce.number({ message: `${label} debe ser un numero.` })])
    .nullish()
    .transform((value): number | null =>
      value === '' || value === null || value === undefined ? null : value,
    )
    .refine(
      (value) =>
        value === null ||
        (value >= rules.priceUsdPerMillion.min && value <= rules.priceUsdPerMillion.max),
      {
        message: `${label} debe estar entre ${rules.priceUsdPerMillion.min} y ${rules.priceUsdPerMillion.max}.`,
      },
    );

/** Formulario de limites de la IA. */
export const aiLimitsSchema = z.object({
  agentEffort: enumFrom(AI_EFFORT_LEVELS),
  quickEffort: enumFrom(AI_EFFORT_LEVELS),
  agentMaxTokens: wholeNumber('Los tokens del agente', rules.agentMaxTokens),
  minResponseTokens: wholeNumber('Los tokens minimos', rules.minResponseTokens),
  turnTimeoutSeconds: wholeNumber('El tiempo por turno', rules.turnTimeoutSeconds),
  maxToolRounds: wholeNumber('Las vueltas de herramientas', rules.maxToolRounds),
  concurrentConversations: wholeNumber(
    'Las conversaciones a la vez',
    rules.concurrentConversations,
  ),
  replyDelaySeconds: wholeNumber('La espera', rules.replyDelaySeconds),
  maxRepliesPerHour: wholeNumber('Las respuestas por hora', rules.maxRepliesPerHour),
  dailyBudgetUsd: z.coerce
    .number({ message: 'El presupuesto debe ser un numero.' })
    .min(rules.dailyBudgetUsd.min, {
      message: `El presupuesto debe estar entre ${rules.dailyBudgetUsd.min} y ${rules.dailyBudgetUsd.max}.`,
    })
    .max(rules.dailyBudgetUsd.max, {
      message: `El presupuesto debe estar entre ${rules.dailyBudgetUsd.min} y ${rules.dailyBudgetUsd.max}.`,
    }),
  inputPriceUsdPerMillion: optionalPrice('El precio de entrada'),
  outputPriceUsdPerMillion: optionalPrice('El precio de salida'),
});

/** Lo que escribe el usuario: los numeros llegan como texto desde los campos. */
export type AiLimitsFormInput = z.input<typeof aiLimitsSchema>;

/** Valores ya convertidos, listos para enviar a la API. */
export type AiLimitsFormValues = z.output<typeof aiLimitsSchema>;
