import { z } from 'zod';

import { VALIDATION_RULES } from './rules';

const rules = VALIDATION_RULES.whatsapp;

/** Respuesta por WhatsApp desde la bandeja. */
export const inboxReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(rules.body.minLength, { message: 'El mensaje no puede estar vacio.' })
    .max(rules.body.maxLength, {
      message: `WhatsApp no admite mensajes de mas de ${rules.body.maxLength} caracteres.`,
    }),
});

export type InboxReplyFormValues = z.output<typeof inboxReplySchema>;
