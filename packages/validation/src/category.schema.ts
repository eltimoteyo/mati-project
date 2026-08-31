import { CATEGORY_COLORS, CATEGORY_STATUSES } from '@conit/types';
import { z } from 'zod';

import { lengthMessages, VALIDATION_RULES } from './rules';
import { enumFrom, optionalText } from './shared';

const rules = VALIDATION_RULES.category;
const nameMessages = lengthMessages('El nombre', rules.name.minLength, rules.name.maxLength);

/**
 * Tiempo objetivo en minutos; vacio significa "sin objetivo definido".
 *
 * El tipo de salida se anota de forma explicita (`number | null`) porque, sin
 * ella, la inferencia de la union + `nullish` + `transform` se ensancha a `{}`
 * y deja de encajar con el contrato `CreateCategoryInput`.
 */
const optionalMinutes = (label: string) =>
  z
    .union([z.literal(''), z.coerce.number()])
    .nullish()
    .transform((value): number | null =>
      value === '' || value === null || value === undefined ? null : value,
    )
    .refine((value) => value === null || (value >= rules.time.min && value <= rules.time.max), {
      message: `${label} debe estar entre ${rules.time.min} y ${rules.time.max} minutos.`,
    });

export const createCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(rules.name.minLength, { message: nameMessages.min })
      .max(rules.name.maxLength, { message: nameMessages.max }),

    description: optionalText(rules.description.maxLength, 'La descripcion'),

    color: enumFrom(CATEGORY_COLORS).default(CATEGORY_COLORS.NEUTRAL),

    responseTimeMinutes: optionalMinutes('El tiempo de primera respuesta'),
    resolutionTimeMinutes: optionalMinutes('El tiempo de resolucion'),

    status: enumFrom(CATEGORY_STATUSES).default(CATEGORY_STATUSES.ACTIVE),
  })
  .refine(
    (value) =>
      value.responseTimeMinutes == null ||
      value.resolutionTimeMinutes == null ||
      value.responseTimeMinutes <= value.resolutionTimeMinutes,
    {
      message: 'El tiempo de resolucion no puede ser menor que el de primera respuesta.',
      path: ['resolutionTimeMinutes'],
    },
  );

export const updateCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(rules.name.minLength, { message: nameMessages.min })
      .max(rules.name.maxLength, { message: nameMessages.max })
      .optional(),
    description: optionalText(rules.description.maxLength, 'La descripcion'),
    color: enumFrom(CATEGORY_COLORS).optional(),
    responseTimeMinutes: optionalMinutes('El tiempo de primera respuesta'),
    resolutionTimeMinutes: optionalMinutes('El tiempo de resolucion'),
    status: enumFrom(CATEGORY_STATUSES).optional(),
  })
  .refine(
    (value) =>
      value.responseTimeMinutes == null ||
      value.resolutionTimeMinutes == null ||
      value.responseTimeMinutes <= value.resolutionTimeMinutes,
    {
      message: 'El tiempo de resolucion no puede ser menor que el de primera respuesta.',
      path: ['resolutionTimeMinutes'],
    },
  );

export type CreateCategoryFormInput = z.input<typeof createCategorySchema>;
export type CreateCategoryFormValues = z.output<typeof createCategorySchema>;
export type UpdateCategoryFormValues = z.output<typeof updateCategorySchema>;
