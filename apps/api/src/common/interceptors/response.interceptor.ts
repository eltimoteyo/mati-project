import type { ApiSuccessResponse } from '@conit/types';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';

import { DEFAULT_SUCCESS_MESSAGE, METADATA_KEYS } from '../constants/app.constants';

/**
 * Envuelve toda respuesta correcta en `{ success, message, data }`.
 *
 * Los controladores devuelven unicamente su carga util; el formato del sobre
 * se aplica en un unico lugar. Los endpoints marcados con `@RawResponse()`
 * quedan excluidos porque su contrato es fijo (por ejemplo `/health`).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | T> {
    const targets = [context.getHandler(), context.getClass()];

    const isRaw = this.reflector.getAllAndOverride<boolean>(METADATA_KEYS.rawResponse, targets);

    if (isRaw) {
      return next.handle();
    }

    const message =
      this.reflector.getAllAndOverride<string>(METADATA_KEYS.responseMessage, targets) ??
      DEFAULT_SUCCESS_MESSAGE;

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        message,
        data: data ?? (null as T),
      })),
    );
  }
}
