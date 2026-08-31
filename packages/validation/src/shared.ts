import { z } from 'zod';

import { VALIDATION_MESSAGES, VALIDATION_RULES } from './rules';

/**
 * Convierte un objeto de constantes (`{ ACTIVE: 'ACTIVE', ... }`) en un enum
 * de Zod. Evita repetir la lista de valores en cada esquema y garantiza que
 * validacion y tipos derivan siempre de la misma fuente.
 */
export function enumFrom<T extends string>(values: Record<string, T>) {
  return z.enum(Object.values(values) as [T, ...T[]]);
}

/** Identificador UUID de una entidad relacionada. */
export const uuidSchema = z.uuid({ message: VALIDATION_MESSAGES.uuid });

/**
 * Campo de texto opcional.
 *
 * Los formularios envian cadena vacia cuando el usuario no escribe nada; se
 * normaliza a `null` para que la base de datos distinga "sin valor" de
 * "valor vacio".
 */
export function optionalText(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .max(maxLength, { message: `${label} no puede superar los ${maxLength} caracteres.` })
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();
}

/** Referencia opcional a otra entidad; la cadena vacia equivale a "ninguna". */
export const optionalUuid = z
  .union([uuidSchema, z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** URL opcional; exige protocolo explicito para evitar enlaces ambiguos. */
export const optionalUrl = z
  .union([
    z.literal(''),
    z
      .url({ message: VALIDATION_MESSAGES.url })
      .max(VALIDATION_RULES.project.url.maxLength)
      .refine((value) => /^https?:\/\//i.test(value), { message: VALIDATION_MESSAGES.url }),
  ])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** Fecha opcional en formato ISO. */
export const optionalDate = z
  .union([z.literal(''), z.iso.datetime({ offset: true }), z.iso.date()])
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

/** Parametros de paginacion aceptados por todos los listados. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(VALIDATION_RULES.pagination.maxPageSize)
    .default(VALIDATION_RULES.pagination.defaultPageSize),
  search: z.string().trim().max(120).optional(),
  sortBy: z.string().trim().max(40).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.input<typeof paginationSchema>;
export type PaginationValues = z.output<typeof paginationSchema>;
