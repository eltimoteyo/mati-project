import { MESSAGE_VISIBILITIES } from '@conit/types';
import { z } from 'zod';

import { VALIDATION_RULES } from './rules';
import { enumFrom } from './shared';

const rules = VALIDATION_RULES.message;

const body = z
  .string()
  .trim()
  .min(rules.body.minLength, { message: 'El mensaje no puede estar vacio.' })
  .max(rules.body.maxLength, {
    message: `El mensaje no puede superar los ${rules.body.maxLength} caracteres.`,
  });

/** Nuevo mensaje en la conversacion de un ticket. */
export const createMessageSchema = z.object({
  body,
  visibility: enumFrom(MESSAGE_VISIBILITIES).default(MESSAGE_VISIBILITIES.PUBLIC),
});

/** Edicion de un mensaje propio; la visibilidad no se cambia despues de enviar. */
export const updateMessageSchema = z.object({ body });

export type CreateMessageFormInput = z.input<typeof createMessageSchema>;
export type CreateMessageFormValues = z.output<typeof createMessageSchema>;
export type UpdateMessageFormValues = z.output<typeof updateMessageSchema>;
