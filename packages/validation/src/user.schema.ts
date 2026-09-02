import { USER_ROLES, USER_STATUSES } from '@conit/types';
import { z } from 'zod';

import { lengthMessages, VALIDATION_MESSAGES, VALIDATION_RULES } from './rules';
import { enumFrom } from './shared';

const nameMessages = lengthMessages(
  'El nombre',
  VALIDATION_RULES.name.minLength,
  VALIDATION_RULES.name.maxLength,
);

const passwordMessages = lengthMessages(
  'La contrasena',
  VALIDATION_RULES.password.minLength,
  VALIDATION_RULES.password.maxLength,
);

const nameSchema = z
  .string()
  .trim()
  .min(VALIDATION_RULES.name.minLength, { message: nameMessages.min })
  .max(VALIDATION_RULES.name.maxLength, { message: nameMessages.max });

const passwordSchema = z
  .string()
  .min(VALIDATION_RULES.password.minLength, { message: passwordMessages.min })
  .max(VALIDATION_RULES.password.maxLength, { message: passwordMessages.max });

/** Alta de un miembro del equipo. */
export const createUserSchema = z.object({
  name: nameSchema,

  email: z
    .string()
    .trim()
    .min(1, { message: VALIDATION_MESSAGES.required })
    .max(VALIDATION_RULES.email.maxLength, { message: VALIDATION_MESSAGES.email.maxLength })
    .toLowerCase()
    .pipe(z.email({ message: VALIDATION_MESSAGES.email.invalid })),

  password: passwordSchema,

  role: enumFrom(USER_ROLES).default(USER_ROLES.ADMIN),
  status: enumFrom(USER_STATUSES).default(USER_STATUSES.ACTIVE),
});

/**
 * Edicion.
 *
 * El correo queda fuera: identifica la cuenta y reasignarlo equivaldria a
 * transferir la identidad de una persona a otra sin dejar rastro.
 */
export const updateUserSchema = z.object({
  name: nameSchema,
  role: enumFrom(USER_ROLES),
  status: enumFrom(USER_STATUSES),
});

/** Restablecimiento de contrasena por parte de un administrador. */
export const resetUserPasswordSchema = z.object({
  password: passwordSchema,
});

export type CreateUserFormInput = z.input<typeof createUserSchema>;
export type CreateUserFormValues = z.output<typeof createUserSchema>;
export type UpdateUserFormValues = z.output<typeof updateUserSchema>;
export type ResetUserPasswordFormValues = z.output<typeof resetUserPasswordSchema>;
