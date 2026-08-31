import { z } from 'zod';

import { lengthMessages, VALIDATION_MESSAGES, VALIDATION_RULES } from './rules';

const nameMessages = lengthMessages(
  'El nombre',
  VALIDATION_RULES.name.minLength,
  VALIDATION_RULES.name.maxLength,
);

/** Datos del perfil que el propio usuario puede editar. */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(VALIDATION_RULES.name.minLength, { message: nameMessages.min })
    .max(VALIDATION_RULES.name.maxLength, { message: nameMessages.max }),
});

const newPassword = z
  .string()
  .min(VALIDATION_RULES.password.minLength, {
    message: VALIDATION_MESSAGES.password.minLength,
  })
  .max(VALIDATION_RULES.password.maxLength, {
    message: VALIDATION_MESSAGES.password.maxLength,
  });

/**
 * Cambio de contrasena.
 *
 * Se pide la actual aunque la sesion ya este iniciada: evita que alguien que
 * encuentre el equipo desbloqueado se apropie de la cuenta, y es la practica
 * habitual en cualquier panel serio.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: VALIDATION_MESSAGES.password.required }),
    newPassword,
    confirmPassword: z.string().min(1, { message: 'Confirma la nueva contrasena.' }),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Las contrasenas no coinciden.',
    path: ['confirmPassword'],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'La nueva contrasena debe ser distinta de la actual.',
    path: ['newPassword'],
  });

export type UpdateProfileFormValues = z.output<typeof updateProfileSchema>;
export type ChangePasswordFormValues = z.output<typeof changePasswordSchema>;
