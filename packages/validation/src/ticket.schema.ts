import { TICKET_PRIORITIES, TICKET_STATUSES } from '@conit/types';
import { z } from 'zod';

import { lengthMessages, VALIDATION_RULES } from './rules';
import { enumFrom, optionalUuid, uuidSchema } from './shared';

const rules = VALIDATION_RULES.ticket;

const subjectMessages = lengthMessages(
  'El asunto',
  rules.subject.minLength,
  rules.subject.maxLength,
);
const descriptionMessages = lengthMessages(
  'La descripcion',
  rules.description.minLength,
  rules.description.maxLength,
);

/** Alta de una incidencia. */
export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(rules.subject.minLength, { message: subjectMessages.min })
    .max(rules.subject.maxLength, { message: subjectMessages.max }),

  description: z
    .string()
    .trim()
    .min(rules.description.minLength, { message: descriptionMessages.min })
    .max(rules.description.maxLength, { message: descriptionMessages.max }),

  clientId: uuidSchema,

  // El servicio afectado, la categoria y el responsable pueden asignarse
  // despues: al registrar la incidencia no siempre se conocen.
  projectId: optionalUuid,
  categoryId: optionalUuid,
  assigneeId: optionalUuid,

  priority: enumFrom(TICKET_PRIORITIES).default(TICKET_PRIORITIES.MEDIUM),
});

/**
 * Edicion.
 *
 * `clientId` no se puede cambiar: el ticket pertenece al cliente que reporto
 * la incidencia y reasignarlo falsearia su historial.
 */
export const updateTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(rules.subject.minLength, { message: subjectMessages.min })
    .max(rules.subject.maxLength, { message: subjectMessages.max })
    .optional(),
  description: z
    .string()
    .trim()
    .min(rules.description.minLength, { message: descriptionMessages.min })
    .max(rules.description.maxLength, { message: descriptionMessages.max })
    .optional(),
  projectId: optionalUuid,
  categoryId: optionalUuid,
  assigneeId: optionalUuid,
  priority: enumFrom(TICKET_PRIORITIES).optional(),
  status: enumFrom(TICKET_STATUSES).optional(),
});

export type CreateTicketFormInput = z.input<typeof createTicketSchema>;
export type CreateTicketFormValues = z.output<typeof createTicketSchema>;
export type UpdateTicketFormValues = z.output<typeof updateTicketSchema>;
