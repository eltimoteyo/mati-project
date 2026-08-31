import { z } from 'zod';

/**
 * Validacion de variables de entorno.
 *
 * Se ejecuta al arrancar: si falta o es invalida cualquier variable critica,
 * el proceso falla inmediatamente con un mensaje claro en lugar de romperse
 * mas tarde en produccion.
 */

/**
 * Booleano tolerante: `Boolean('false')` es `true` en JavaScript, asi que no
 * podemos usar `z.coerce.boolean()` para valores que llegan como texto.
 */
const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      if (typeof value === 'boolean') return value;
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

const envNumber = (defaultValue: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      const parsed = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    })
    .pipe(z.number().int().positive());

/** Duraciones abreviadas aceptadas por `jsonwebtoken` (15m, 7d, 30d...). */
const duration = (defaultValue: string) =>
  z
    .string()
    .regex(/^\d+(\.\d+)?\s*(ms|s|m|h|d|w)$|^\d+$/i, {
      message: 'Formato de duracion invalido. Usa por ejemplo 15m, 12h o 7d.',
    })
    .default(defaultValue);

const SECRET_MIN_LENGTH = 32;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // --- Servidor -------------------------------------------------------------
  PORT: envNumber(4000),
  API_PREFIX: z.string().min(1).default('api/v1'),

  // --- Base de datos --------------------------------------------------------
  DATABASE_URL: z
    .string()
    .min(1, { message: 'DATABASE_URL es obligatoria.' })
    .refine((value) => value.startsWith('postgres://') || value.startsWith('postgresql://'), {
      message: 'DATABASE_URL debe ser una cadena de conexion PostgreSQL.',
    }),

  // --- JWT ------------------------------------------------------------------
  JWT_SECRET: z.string().min(SECRET_MIN_LENGTH, {
    message: `JWT_SECRET debe tener al menos ${SECRET_MIN_LENGTH} caracteres.`,
  }),
  JWT_REFRESH_SECRET: z.string().min(SECRET_MIN_LENGTH, {
    message: `JWT_REFRESH_SECRET debe tener al menos ${SECRET_MIN_LENGTH} caracteres.`,
  }),
  JWT_ACCESS_EXPIRES_IN: duration('15m'),
  JWT_REFRESH_EXPIRES_IN: duration('7d'),
  JWT_REFRESH_REMEMBER_EXPIRES_IN: duration('30d'),

  // --- Cookies --------------------------------------------------------------
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: envBoolean(false),
  /**
   * `lax` cubre el caso habitual (web y API bajo el mismo dominio registrable,
   * aunque sea en puertos distintos). Solo hace falta `none` cuando el frontend
   * vive en otro sitio, y entonces `COOKIE_SECURE` debe ser `true`.
   */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  // --- CORS -----------------------------------------------------------------
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  /** Lista separada por comas; si se omite se usa FRONTEND_URL. */
  CORS_ORIGINS: z.string().optional(),

  // --- Rate limiting --------------------------------------------------------
  THROTTLE_TTL: envNumber(60_000),
  THROTTLE_LIMIT: envNumber(120),

  // --- Documentacion --------------------------------------------------------
  SWAGGER_ENABLED: envBoolean(true),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `process.env` y aborta el arranque con un resumen legible si algo
 * falta. `@nestjs/config` invoca esta funcion mediante la opcion `validate`.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuracion de entorno invalida.\n${issues}\n\n` +
        'Revisa tu archivo .env (puedes partir de .env.example).',
    );
  }

  // En produccion los secretos por defecto del ejemplo no son aceptables.
  if (result.data.NODE_ENV === 'production') {
    const placeholders = ['reemplaza', 'change_me', 'secret', 'changeme'];
    const usesPlaceholder = [result.data.JWT_SECRET, result.data.JWT_REFRESH_SECRET].some(
      (secret) => placeholders.some((word) => secret.toLowerCase().includes(word)),
    );

    if (usesPlaceholder) {
      throw new Error(
        'Los secretos JWT contienen valores de ejemplo. Genera secretos reales antes de desplegar ' +
          '(por ejemplo: openssl rand -base64 48).',
      );
    }
  }

  if (result.data.COOKIE_SAMESITE === 'none' && !result.data.COOKIE_SECURE) {
    throw new Error(
      'COOKIE_SAMESITE=none exige COOKIE_SECURE=true: los navegadores descartan ' +
        'las cookies SameSite=None que no viajan por HTTPS.',
    );
  }

  return result.data;
}
