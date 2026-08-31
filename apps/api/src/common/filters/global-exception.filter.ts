import { API_ERROR_CODES, type ApiErrorCode, type ApiErrorResponse } from '@conit/types';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import type { AppConfig } from '../../config/configuration';
import { GENERIC_ERROR_MESSAGE } from '../constants/app.constants';

/** Correspondencia entre codigo HTTP y codigo de error estable de la API. */
const STATUS_TO_ERROR_CODE: Record<number, ApiErrorCode> = {
  [HttpStatus.BAD_REQUEST]: API_ERROR_CODES.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: API_ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: API_ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: API_ERROR_CODES.NOT_FOUND,
  [HttpStatus.CONFLICT]: API_ERROR_CODES.CONFLICT,
  [HttpStatus.UNPROCESSABLE_ENTITY]: API_ERROR_CODES.VALIDATION_ERROR,
  [HttpStatus.TOO_MANY_REQUESTS]: API_ERROR_CODES.TOO_MANY_REQUESTS,
  [HttpStatus.SERVICE_UNAVAILABLE]: API_ERROR_CODES.SERVICE_UNAVAILABLE,
};

/** Errores de Prisma que tienen una traduccion HTTP significativa. */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: string; code: ApiErrorCode }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'El registro ya existe',
    code: API_ERROR_CODES.CONFLICT,
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: 'El registro solicitado no existe',
    code: API_ERROR_CODES.NOT_FOUND,
  },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'La operacion viola una referencia existente',
    code: API_ERROR_CODES.BAD_REQUEST,
  },
};

interface PrismaKnownError {
  code: string;
  clientVersion: string;
}

/**
 * Detecta errores conocidos de Prisma sin acoplarse al cliente generado
 * (evita romper el build cuando `prisma generate` aun no se ha ejecutado).
 */
function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'clientVersion' in error &&
    typeof (error as PrismaKnownError).code === 'string' &&
    /^P\d{4}$/.test((error as PrismaKnownError).code)
  );
}

interface NormalizedError {
  status: number;
  message: string;
  code: ApiErrorCode | string;
  details?: Record<string, string[]>;
}

/**
 * Filtro global de excepciones.
 *
 * Unifica cualquier fallo en el contrato de error de la API y garantiza que
 * los detalles internos (stack, mensajes de driver, rutas de archivo) nunca
 * lleguen al cliente. Todo error 5xx se registra completo en el servidor.
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const normalized = this.normalize(exception);
    const isServerError = normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (isServerError) {
      // Solo los 5xx dejan traza completa: son fallos nuestros, no del cliente.
      this.logger.error(
        `${request.method} ${request.url} -> ${normalized.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${normalized.status} (${normalized.code})`,
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      message: normalized.message,
      error: normalized.code,
      ...(normalized.details ? { details: normalized.details } : {}),
    };

    response.status(normalized.status).json(body);
  }

  /** Traduce cualquier excepcion al contrato de error de la API. */
  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (isPrismaKnownError(exception)) {
      const mapped = PRISMA_ERROR_MAP[exception.code];

      if (mapped) {
        return { status: mapped.status, message: mapped.message, code: mapped.code };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.serverErrorMessage(exception),
      code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
    };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const fallbackCode = STATUS_TO_ERROR_CODE[status] ?? API_ERROR_CODES.INTERNAL_SERVER_ERROR;

    if (typeof payload === 'string') {
      return { status, message: payload, code: fallbackCode };
    }

    const record = payload as Record<string, unknown>;
    const rawMessage = record['message'];

    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : Array.isArray(rawMessage) && typeof rawMessage[0] === 'string'
          ? rawMessage[0]
          : exception.message;

    const details =
      typeof record['details'] === 'object' && record['details'] !== null
        ? (record['details'] as Record<string, string[]>)
        : undefined;

    const code =
      typeof record['error'] === 'string' && /^[A-Z_]+$/.test(record['error'])
        ? (record['error'] as ApiErrorCode)
        : fallbackCode;

    return {
      status,
      message: status >= HttpStatus.INTERNAL_SERVER_ERROR ? GENERIC_ERROR_MESSAGE : message,
      code,
      ...(details ? { details } : {}),
    };
  }

  /**
   * En desarrollo devolvemos el mensaje real para acelerar el diagnostico;
   * en produccion siempre un texto generico.
   */
  private serverErrorMessage(exception: unknown): string {
    const isProduction = this.configService.get('isProduction', { infer: true });

    if (isProduction || !(exception instanceof Error)) {
      return GENERIC_ERROR_MESSAGE;
    }

    return `${GENERIC_ERROR_MESSAGE}: ${exception.message}`;
  }
}
