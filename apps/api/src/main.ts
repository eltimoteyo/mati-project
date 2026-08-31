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
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const configService = app.get(ConfigService<AppConfig, true>);

  const port = configService.get('port', { infer: true });
  const apiPrefix = configService.get('apiPrefix', { infer: true });
  const cors = configService.get('cors', { infer: true });
  const isProduction = configService.get('isProduction', { infer: true });

  // Detras de Nginx o Traefik, `req.ip` debe reflejar la IP real del cliente:
  // de ello depende que el rate limiting cuente por usuario y no por proxy.
  app.set('trust proxy', 1);

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
    origin: cors.origins,
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
