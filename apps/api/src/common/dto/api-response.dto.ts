import { API_ERROR_CODES, type ApiErrorCode } from '@conit/types';
import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

/** Envoltura de exito documentada en Swagger. */
export class ApiSuccessDto {
  @ApiProperty({ example: true, description: 'Siempre `true` en respuestas correctas.' })
  success!: true;

  @ApiProperty({ example: 'Operacion realizada correctamente' })
  message!: string;

  @ApiProperty({ description: 'Carga util de la operacion.' })
  data!: unknown;
}

/** Envoltura de error documentada en Swagger. */
export class ApiErrorDto {
  @ApiProperty({ example: false, description: 'Siempre `false` en respuestas de error.' })
  success!: false;

  @ApiProperty({
    example: 'Credenciales incorrectas',
    description: 'Mensaje apto para mostrar al usuario final.',
  })
  message!: string;

  @ApiProperty({
    enum: Object.values(API_ERROR_CODES),
    example: API_ERROR_CODES.UNAUTHORIZED,
    description: 'Codigo estable para que el cliente decida el flujo.',
  })
  error!: ApiErrorCode;

  @ApiPropertyOptional({
    description: 'Errores por campo. Presente solo en fallos de validacion.',
    example: { email: ['Ingresa un correo electronico valido.'] },
    additionalProperties: { type: 'array', items: { type: 'string' } },
  })
  details?: Record<string, string[]>;
}

interface EnvelopeOptions {
  status?: number;
  description?: string;
  /** El endpoint devuelve una coleccion del modelo en lugar de un solo objeto. */
  isArray?: boolean;
}

/**
 * Documenta en Swagger una respuesta correcta envuelta en `{ success, message, data }`.
 *
 * OpenAPI no soporta genericos, por lo que la envoltura se compone a mano con
 * `allOf` para no duplicar el esquema en cada endpoint.
 */
export function ApiEnvelopeResponse<TModel extends Type<unknown>>(
  model: TModel,
  { status = 200, description = 'Operacion correcta', isArray = false }: EnvelopeOptions = {},
) {
  const data = isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(ApiSuccessDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [{ $ref: getSchemaPath(ApiSuccessDto) }, { properties: { data } }],
      },
    }),
  );
}

/** Metadatos de paginacion documentados en Swagger. */
export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 137 })
  total!: number;

  @ApiProperty({ example: 7 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;
}

/**
 * Documenta un listado paginado envuelto en `{ success, message, data }`,
 * donde `data` es `{ items, meta }`.
 */
export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
  { status = 200, description = 'Listado paginado' }: EnvelopeOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(ApiSuccessDto, PaginationMetaDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessDto) },
          {
            properties: {
              data: {
                type: 'object',
                properties: {
                  items: { type: 'array', items: { $ref: getSchemaPath(model) } },
                  meta: { $ref: getSchemaPath(PaginationMetaDto) },
                },
              },
            },
          },
        ],
      },
    }),
  );
}

/** Documenta una respuesta de error con la envoltura estandar. */
export function ApiErrorResponse(status: number, description: string) {
  return applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ApiResponse({
      status,
      description,
      schema: { $ref: getSchemaPath(ApiErrorDto) },
    }),
  );
}
