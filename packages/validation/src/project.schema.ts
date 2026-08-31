import { PROJECT_STATUSES, SERVICE_TYPES } from '@conit/types';
import { z } from 'zod';

import { lengthMessages, VALIDATION_RULES } from './rules';
import { enumFrom, optionalDate, optionalText, optionalUrl, uuidSchema } from './shared';

const rules = VALIDATION_RULES.project;
const nameMessages = lengthMessages('El nombre', rules.name.minLength, rules.name.maxLength);

/** Alta de un proyecto o servicio contratado. */
export const createProjectSchema = z
  .object({
    clientId: uuidSchema,

    name: z
      .string()
      .trim()
      .min(rules.name.minLength, { message: nameMessages.min })
      .max(rules.name.maxLength, { message: nameMessages.max }),

    type: enumFrom(SERVICE_TYPES),

    description: optionalText(rules.description.maxLength, 'La descripcion'),
    url: optionalUrl,

    status: enumFrom(PROJECT_STATUSES).default(PROJECT_STATUSES.ACTIVE),

    startedAt: optionalDate,
    expiresAt: optionalDate,
  })
  .refine(
    (value) =>
      !value.startedAt || !value.expiresAt || new Date(value.startedAt) <= new Date(value.expiresAt),
    {
      message: 'La fecha de vencimiento no puede ser anterior a la de inicio.',
      path: ['expiresAt'],
    },
  );

/**
 * Edicion.
 *
 * `clientId` queda fuera a proposito: mover un servicio de un cliente a otro
 * arrastraria sus tickets al historial de otra empresa. Si hiciera falta,
 * seria una operacion explicita, no una edicion de formulario.
 */
export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(rules.name.minLength, { message: nameMessages.min })
      .max(rules.name.maxLength, { message: nameMessages.max })
      .optional(),
    type: enumFrom(SERVICE_TYPES).optional(),
    description: optionalText(rules.description.maxLength, 'La descripcion'),
    url: optionalUrl,
    status: enumFrom(PROJECT_STATUSES).optional(),
    startedAt: optionalDate,
    expiresAt: optionalDate,
  })
  .refine(
    (value) =>
      !value.startedAt || !value.expiresAt || new Date(value.startedAt) <= new Date(value.expiresAt),
    {
      message: 'La fecha de vencimiento no puede ser anterior a la de inicio.',
      path: ['expiresAt'],
    },
  );

export type CreateProjectFormInput = z.input<typeof createProjectSchema>;
export type CreateProjectFormValues = z.output<typeof createProjectSchema>;
export type UpdateProjectFormValues = z.output<typeof updateProjectSchema>;
