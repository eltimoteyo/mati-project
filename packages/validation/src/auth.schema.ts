import { z } from 'zod';

import { VALIDATION_MESSAGES, VALIDATION_RULES } from './rules';

/**
 * Esquema del formulario de inicio de sesion.
 * Se usa en el frontend con React Hook Form y refleja exactamente
 * las reglas que la API valida en `LoginDto`.
 */
export const loginSchema = z.object({
  email: z
    .string({ message: VALIDATION_MESSAGES.required })
    .trim()
    .min(1, { message: VALIDATION_MESSAGES.required })
    .max(VALIDATION_RULES.email.maxLength, { message: VALIDATION_MESSAGES.email.maxLength })
    .toLowerCase()
    .pipe(z.email({ message: VALIDATION_MESSAGES.email.invalid })),
  password: z
    .string({ message: VALIDATION_MESSAGES.password.required })
    .min(1, { message: VALIDATION_MESSAGES.password.required })
    .max(VALIDATION_RULES.password.maxLength, { message: VALIDATION_MESSAGES.password.maxLength }),
  rememberMe: z.boolean().optional().default(false),
});

/** Valores tal como los escribe el usuario (antes de transformaciones). */
export type LoginFormInput = z.input<typeof loginSchema>;
/** Valores ya normalizados y validados. */
export type LoginFormValues = z.output<typeof loginSchema>;
