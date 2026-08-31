import { CLIENT_STATUSES } from '@conit/types';
import { z } from 'zod';

import { lengthMessages, VALIDATION_MESSAGES, VALIDATION_RULES } from './rules';
import { enumFrom, optionalText } from './shared';

const rules = VALIDATION_RULES.client;
const nameMessages = lengthMessages('El nombre', rules.name.minLength, rules.name.maxLength);

/** Alta de un cliente. */
export const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(rules.name.minLength, { message: nameMessages.min })
    .max(rules.name.maxLength, { message: nameMessages.max }),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(VALIDATION_RULES.email.maxLength, { message: VALIDATION_MESSAGES.email.maxLength })
    .pipe(z.email({ message: VALIDATION_MESSAGES.email.invalid })),

  taxId: optionalText(rules.taxId.maxLength, 'El identificador fiscal'),
  contactName: optionalText(rules.contactName.maxLength, 'El nombre de contacto'),
  phone: optionalText(rules.phone.maxLength, 'El telefono'),
  address: optionalText(rules.address.maxLength, 'La direccion'),
  notes: optionalText(rules.notes.maxLength, 'Las notas'),

  status: enumFrom(CLIENT_STATUSES).default(CLIENT_STATUSES.ACTIVE),
});

/** Edicion: todos los campos son opcionales. */
export const updateClientSchema = createClientSchema.partial();

export type CreateClientFormInput = z.input<typeof createClientSchema>;
export type CreateClientFormValues = z.output<typeof createClientSchema>;
export type UpdateClientFormValues = z.output<typeof updateClientSchema>;
