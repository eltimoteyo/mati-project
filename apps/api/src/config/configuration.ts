import { isAbsolute, resolve } from 'node:path';

import { durationToMs, durationToSeconds } from '../common/utils/duration.util';
import { type Env, envSchema } from './env.validation';

/**
 * Configuracion tipada de la aplicacion.
 *
 * Se construye una sola vez a partir del entorno ya validado y se consume
 * mediante `ConfigService<AppConfig, true>`. Ningun modulo lee `process.env`
 * directamente: asi el origen de la configuracion es unico y auditable.
 */
export function configuration() {
  // `@nestjs/config` ya valido el entorno con `validateEnv`; aqui volvemos a
  // parsear para obtener el objeto tipado con los valores por defecto aplicados.
  const env: Env = envSchema.parse(process.env);

  const corsOrigins = (env.CORS_ORIGINS ?? env.FRONTEND_URL)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    port: env.PORT,
    apiPrefix: env.API_PREFIX,

    database: {
      url: env.DATABASE_URL,
    },

    jwt: {
      accessSecret: env.JWT_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
      refreshRememberExpiresIn: env.JWT_REFRESH_REMEMBER_EXPIRES_IN,
      accessTtlMs: durationToMs(env.JWT_ACCESS_EXPIRES_IN),
      accessTtlSeconds: durationToSeconds(env.JWT_ACCESS_EXPIRES_IN),
      refreshTtlMs: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
      refreshRememberTtlMs: durationToMs(env.JWT_REFRESH_REMEMBER_EXPIRES_IN),
    },

    cookies: {
      domain: env.COOKIE_DOMAIN && env.COOKIE_DOMAIN.length > 0 ? env.COOKIE_DOMAIN : undefined,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
    },

    cors: {
      frontendUrl: env.FRONTEND_URL,
      origins: corsOrigins,
    },

    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
    },

    swagger: {
      enabled: env.SWAGGER_ENABLED,
      path: 'api/docs',
    },

    ai: {
      provider: env.AI_PROVIDER,
      anthropicVersion: env.ANTHROPIC_API_VERSION,
      apiKey: env.AI_PROVIDER === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENROUTER_API_KEY,
      model:
        env.AI_MODEL_FAST ??
        (env.AI_PROVIDER === 'anthropic'
          ? env.ANTHROPIC_MODEL
          : (env.OPENROUTER_MODEL_FAST ?? env.OPENROUTER_MODEL)),
      agentModel:
        env.AI_MODEL_AGENT ??
        (env.AI_PROVIDER === 'anthropic'
          ? env.ANTHROPIC_MODEL
          : (env.OPENROUTER_MODEL_AGENT ?? env.OPENROUTER_MODEL)),
      agentEnabled: env.AI_AGENT_ENABLED,
      agentFallbackModels: env.AI_AGENT_FALLBACK_MODELS.split(',')
        .map((model) => model.trim())
        .filter(Boolean),
      inputPrice: env.AI_INPUT_USD_PER_MILLION,
      outputPrice: env.AI_OUTPUT_USD_PER_MILLION,
      dailyBudget: env.AI_DAILY_BUDGET_USD,
      allowedDomains: env.AI_ALLOWED_DOMAINS.split(',')
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
      openrouterKey: env.OPENROUTER_API_KEY,
      embeddingModel: env.AI_EMBEDDING_MODEL,
      vectorEnabled: env.AI_VECTOR_ENABLED,
      dnsblZones: env.AI_DNSBL_ZONES.split(',')
        .map((zone) => zone.trim())
        .filter(Boolean),
      mediaEnabled: env.AI_MEDIA_ENABLED,
      transcriptionUrl: env.AI_TRANSCRIPTION_URL,
      transcriptionKey: env.AI_TRANSCRIPTION_KEY,
      transcriptionModel: env.AI_TRANSCRIPTION_MODEL,
      monitorEnabled: env.AI_MONITOR_ENABLED,
      mediaRetentionDays: env.AI_MEDIA_RETENTION_DAYS,
      fallbackModels: env.OPENROUTER_FALLBACK_MODELS.split(',')
        .map((model) => model.trim())
        .filter(Boolean),
      baseUrl: env.AI_PROVIDER === 'anthropic' ? env.ANTHROPIC_BASE_URL : env.OPENROUTER_BASE_URL,
      openrouterBaseUrl: env.OPENROUTER_BASE_URL,
      // La disponibilidad se decide aqui una sola vez: los servicios preguntan
      // por este booleano en lugar de comprobar si hay clave cada vez.
      enabled: Boolean(
        env.AI_PROVIDER === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENROUTER_API_KEY,
      ),
    },

    mail: {
      apiKey: env.RESEND_API_KEY,
      from: env.MAIL_FROM,
      replyTo: env.MAIL_REPLY_TO,
      logoUrl: env.MAIL_LOGO_URL,
      enabled: env.MAIL_ENABLED && Boolean(env.RESEND_API_KEY),
      /** Se usa para componer los enlaces del correo. */
      appUrl: env.FRONTEND_URL,
      /**
       * Recepcion de correo. Exige clave de API (para leer el cuerpo) y
       * secreto de webhook (para comprobar la firma): sin cualquiera de los
       * dos, el endpoint responde que no esta configurado.
       */
      inbound: {
        webhookSecret: env.RESEND_WEBHOOK_SECRET,
        enabled: Boolean(env.RESEND_API_KEY) && Boolean(env.RESEND_WEBHOOK_SECRET),
      },
    },

    whatsapp: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      /** Numero de WhatsApp de CONIT, con prefijo `whatsapp:`. */
      fromNumber: env.TWILIO_WHATSAPP_NUMBER,
      enabled:
        env.WHATSAPP_ENABLED && Boolean(env.TWILIO_ACCOUNT_SID) && Boolean(env.TWILIO_AUTH_TOKEN),
      /**
       * Avisos salientes por la Cloud API de Meta. Es independiente de la
       * recepcion por Twilio: cada una se activa con sus propias credenciales.
       */
      cloud: {
        accessToken: env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        graphVersion: env.WHATSAPP_GRAPH_VERSION,
        ticketStatusTemplate: env.WHATSAPP_TEMPLATE_TICKET_STATUS,
        templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE,
        enabled:
          env.WHATSAPP_ENABLED &&
          Boolean(env.WHATSAPP_ACCESS_TOKEN) &&
          Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
        /**
         * Recepcion para la bandeja. Exige la clave de la app (para comprobar
         * la firma) y el token de verificacion (para registrar el webhook).
         */
        appSecret: env.WHATSAPP_APP_SECRET,
        verifyToken: env.WHATSAPP_VERIFY_TOKEN,
        inboundEnabled: Boolean(env.WHATSAPP_APP_SECRET) && Boolean(env.WHATSAPP_VERIFY_TOKEN),
      },
    },

    uploads: {
      /** Ruta absoluta: el proceso puede arrancar desde otro directorio. */
      dir: isAbsolute(env.UPLOADS_DIR) ? env.UPLOADS_DIR : resolve(process.cwd(), env.UPLOADS_DIR),
    },
  };
}

export type AppConfig = ReturnType<typeof configuration>;
