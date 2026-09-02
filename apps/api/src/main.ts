import 'reflect-metadata';

import { API_ERROR_CODES } from '@conit/types';
import {
  BadRequestException,
  Logger,
  RequestMethod,
  type ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { setupSwagger } from './swagger';

/**
 * Convierte los errores de `class-validator` en el contrato de error de la
 * API: un mensaje legible mas el detalle por campo que consume el formulario.
 */
function buildValidationException(errors: ValidationError[]): BadRequestException {
  const details: Record<string, string[]> = {};

  const collect = (error: ValidationError, parentPath = ''): void => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});

    if (messages.length > 0) {
      details[path] = messages;
    }

    error.children?.forEach((child) => collect(child, path));
  };

  errors.forEach((error) => collect(error));

  const firstMessage = Object.values(details)[0]?.[0] ?? 'Los datos enviados no son validos';

  return new BadRequestException({
    message: firstMessage,
    error: API_ERROR_CODES.VALIDATION_ERROR,
    details,
  });
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
    // Conserva el cuerpo sin parsear de cada peticion. Lo necesita el webhook
    // de correo entrante: la firma se calcula sobre los bytes exactos, y
    // volver a serializar el objeto la invalidaria.
    rawBody: true,
  });
  const configService = app.get(ConfigService<AppConfig, true>);

  const port = configService.get('port', { infer: true });
  const apiPrefix = configService.get('apiPrefix', { infer: true });
  const cors = configService.get('cors', { infer: true });
  const isProduction = configService.get('isProduction', { infer: true });

  // Detras de Nginx o Traefik, `req.ip` debe reflejar la IP real del cliente:
  // de ello depende que el rate limiting cuente por usuario y no por proxy.
  app.set('trust proxy', 1);

  /*
   * Ficheros subidos (fotos de perfil).
   *
   * Se sirven fuera del prefijo de la API porque son recursos estaticos, no
   * endpoints. `index: false` evita listar el directorio, y las cabeceras
   * fuerzan que el navegador los trate como datos: sin `nosniff`, un fichero
   * manipulado podria intentar ejecutarse como script en el dominio.
   */
  app.useStaticAssets(configService.get('uploads', { infer: true }).dir, {
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
    setHeaders: (response) => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
      response.setHeader('Cache-Control', 'public, max-age=86400');
    },
  });

  app.use(
    helmet({
      // La API solo devuelve JSON; la unica superficie HTML es Swagger UI,
      // que necesita estilos y scripts en linea para renderizarse.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: (origin, callback) => {
      // Permite peticiones sin origin (curl, server-to-server, scripts, webhooks)
      if (!origin) {
        return callback(null, true);
      }

      // Origenes explicitamente configurados
      if (cors.origins.includes(origin) || cors.origins.includes('*')) {
        return callback(null, true);
      }

      // Permite automaticamente dominios de produccion y preview de Vercel (*.vercel.app)
      if (/^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin)) {
        return callback(null, true);
      }

      // En desarrollo permite cualquier puerto de localhost
      if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      callback(null, false);
    },
    // Imprescindible para que el navegador envie las cookies de sesion.
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
    maxAge: 86_400,
  });

  app.setGlobalPrefix(apiPrefix, {
    // `/health` queda fuera del prefijo: es un contrato de infraestructura
    // que consumen Docker y los balanceadores, no un recurso versionado.
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: true,
      exceptionFactory: buildValidationException,
    }),
  );

  app.enableShutdownHooks();

  const swaggerPath = setupSwagger(app, configService);

  await app.listen(port, '0.0.0.0');

  logger.log(`API disponible en http://localhost:${port}/${apiPrefix}`);
  logger.log(`Health check en   http://localhost:${port}/health`);

  if (swaggerPath) {
    logger.log(`Documentacion en  http://localhost:${port}/${swaggerPath}`);
  }

  if (isProduction) {
    logger.log('Modo produccion: documentacion y mensajes detallados restringidos');
  }
}

void bootstrap();
