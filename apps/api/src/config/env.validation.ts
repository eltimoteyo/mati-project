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

  // --- Asistente de IA ------------------------------------------------------
  // Todas opcionales: sin clave, el modulo se declara no disponible y el resto
  // del sistema arranca y funciona igual.
  OPENROUTER_API_KEY: z.string().trim().optional(),
  /**
   * Modelo principal.
   *
   * Por defecto uno gratuito, para que el asistente funcione con una cuenta sin
   * saldo. Con creditos en OpenRouter, `anthropic/claude-haiku-4.5` da mejor
   * calidad por muy poco coste y basta con cambiar esta linea.
   */
  OPENROUTER_MODEL: z.string().trim().default('nvidia/nemotron-3-super-120b-a12b:free'),
  /**
   * Modelos de reserva, separados por comas.
   *
   * Los modelos gratuitos comparten cupo entre todos los usuarios de OpenRouter
   * y devuelven 429 con frecuencia; sin reserva, el asistente quedaria caido en
   * cuanto uno se saturase.
   */
  OPENROUTER_FALLBACK_MODELS: z
    .string()
    .trim()
    .default('z-ai/glm-5.2:free,google/gemma-4-31b-it:free,minimax/minimax-m3:free'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),

  // --- Correo saliente ------------------------------------------------------
  RESEND_API_KEY: z.string().trim().optional(),
  /**
   * Remitente. Debe pertenecer a un dominio verificado en Resend; mientras no
   * lo este, `onboarding@resend.dev` solo entrega al correo del titular.
   */
  MAIL_FROM: z.string().trim().default('CONIT Support <onboarding@resend.dev>'),
  MAIL_REPLY_TO: z.string().trim().optional(),
  /**
   * URL publica del logo que se incrusta en los correos.
   *
   * Tiene que ser accesible desde internet: el cliente de correo la descarga
   * desde el navegador del destinatario, asi que una ruta de localhost se veria
   * rota. Si se deja vacia, el correo muestra el nombre en tipografia de marca
   * en lugar de la imagen.
   */
  MAIL_LOGO_URL: z.string().trim().optional(),
  /** Desactiva el envio sin tener que borrar la clave. */
  MAIL_ENABLED: envBoolean(true),

  /**
   * Secreto del webhook de correo entrante (Resend / Svix), con prefijo
   * `whsec_`. Sin el, la recepcion de correo queda desactivada: aceptar
   * webhooks sin firmar permitiria a cualquiera crear tickets.
   */
  RESEND_WEBHOOK_SECRET: z.string().trim().optional(),

  // --- WhatsApp (Twilio) — opcional ------------------------------------------
  // Se considera listo solo con credenciales, numero remitente y URL publica.
  TWILIO_ACCOUNT_SID: z.string().trim().optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().optional(),
  /** Numero de WhatsApp de CONIT en formato `whatsapp:+...`. */
  TWILIO_WHATSAPP_NUMBER: z.string().trim().optional(),
  /** URL publica HTTPS del webhook configurada en Twilio. */
  WHATSAPP_WEBHOOK_URL: z.string().trim().url().optional(),
  /** Desactiva el envio sin tener que borrar las credenciales. */
  WHATSAPP_ENABLED: envBoolean(true),

  // --- WhatsApp (Meta Cloud API) — opcional ----------------------------------
  // Avisos al cliente cuando su ticket llega a un estado final. Sin token o sin
  // identificador de numero, el aviso se omite y el resto funciona igual.
  WHATSAPP_ACCESS_TOKEN: z.string().trim().optional(),
  /** Identificador del numero remitente en Meta; no es el numero de telefono. */
  WHATSAPP_PHONE_NUMBER_ID: z.string().trim().optional(),
  /** Version de la Graph API. Meta retira las antiguas cada cierto tiempo. */
  WHATSAPP_GRAPH_VERSION: z
    .string()
    .trim()
    .regex(/^v\d+\.\d+$/, { message: 'Formato de version invalido. Usa por ejemplo v26.0.' })
    .default('v26.0'),
  /**
   * Plantilla del aviso de estado final.
   *
   * Tiene que existir y estar aprobada en Meta con tres variables en el
   * cuerpo: codigo, asunto y estado. Si Meta la rechaza, el aviso sale como
   * texto libre, que solo llega si el cliente escribio en las ultimas 24 horas.
   */
  WHATSAPP_TEMPLATE_TICKET_STATUS: z.string().trim().min(1).default('ticket_actualizacion'),
  /** Codigo de idioma con el que se aprobo la plantilla. */
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().trim().min(1).default('es'),

  /**
   * Carpeta donde se guardan los ficheros subidos (fotos de perfil).
   *
   * En Docker debe apuntar a un volumen: dentro de la imagen se perderia en
   * cada despliegue.
   */
  UPLOADS_DIR: z.string().trim().default('uploads'),
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
