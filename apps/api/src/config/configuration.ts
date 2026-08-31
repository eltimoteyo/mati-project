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
  };
}

export type AppConfig = ReturnType<typeof configuration>;
