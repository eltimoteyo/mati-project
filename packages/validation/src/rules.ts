/**
 * Reglas de validacion unicas para todo el sistema.
 *
 * La API (class-validator) y el frontend (Zod) importan estas constantes,
 * de modo que un cambio de politica no puede desincronizarse entre capas.
 * Los limites coinciden con los del esquema de Prisma: si aqui se permite mas
 * de lo que la columna admite, el fallo aparecera en base de datos en lugar de
 * como un error de validacion legible.
 */

export const VALIDATION_RULES = {
  name: {
    minLength: 3,
    maxLength: 120,
  },
  email: {
    maxLength: 180,
  },
  password: {
    minLength: 8,
    maxLength: 128,
  },

  // --- Dominio (Fase 2) ------------------------------------------------------
  client: {
    name: { minLength: 2, maxLength: 160 },
    taxId: { maxLength: 20 },
    contactName: { maxLength: 120 },
    phone: { maxLength: 40 },
    address: { maxLength: 300 },
    notes: { maxLength: 2000 },
  },
  project: {
    name: { minLength: 2, maxLength: 160 },
    description: { maxLength: 2000 },
    url: { maxLength: 300 },
  },
  category: {
    name: { minLength: 2, maxLength: 80 },
    description: { maxLength: 300 },
    /** Tiempos objetivo en minutos: de 5 minutos a 30 dias. */
    time: { min: 5, max: 43_200 },
  },
  ticket: {
    subject: { minLength: 5, maxLength: 200 },
    description: { minLength: 10, maxLength: 10_000 },
  },
  message: {
    body: { minLength: 1, maxLength: 5000 },
  },
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },
} as const;

/** Mensajes de validacion en espanol, reutilizables por ambas capas. */
export const VALIDATION_MESSAGES = {
  required: 'Este campo es obligatorio.',
  email: {
    invalid: 'Ingresa un correo electronico valido.',
    maxLength: `El correo no puede superar los ${VALIDATION_RULES.email.maxLength} caracteres.`,
  },
  password: {
    required: 'La contrasena es obligatoria.',
    minLength: `La contrasena debe tener al menos ${VALIDATION_RULES.password.minLength} caracteres.`,
    maxLength: `La contrasena no puede superar los ${VALIDATION_RULES.password.maxLength} caracteres.`,
  },
  name: {
    minLength: `El nombre debe tener al menos ${VALIDATION_RULES.name.minLength} caracteres.`,
    maxLength: `El nombre no puede superar los ${VALIDATION_RULES.name.maxLength} caracteres.`,
  },
  uuid: 'El identificador seleccionado no es valido.',
  url: 'Ingresa una URL valida (debe comenzar por http:// o https://).',
  select: 'Selecciona una opcion.',
} as const;

/** Construye los mensajes de longitud de un campo concreto. */
export function lengthMessages(label: string, min: number, max: number) {
  return {
    min: `${label} debe tener al menos ${min} caracteres.`,
    max: `${label} no puede superar los ${max} caracteres.`,
  };
}
