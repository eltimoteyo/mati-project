import type { PaginatedData, PaginationMeta } from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const { defaultPageSize, maxPageSize } = VALIDATION_RULES.pagination;

/**
 * Parametros de paginacion comunes a todos los listados.
 *
 * Los modulos la extienden para anadir sus filtros propios. `sortBy` no se
 * declara aqui: cada listado debe restringirlo a sus columnas permitidas, para
 * que un valor arbitrario no llegue nunca al `orderBy` de Prisma.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Pagina solicitada (base 1).' })
  @Type(() => Number)
  @IsInt({ message: 'La pagina debe ser un numero entero.' })
  @Min(1, { message: 'La pagina debe ser 1 o mayor.' })
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: maxPageSize, default: defaultPageSize })
  @Type(() => Number)
  @IsInt({ message: 'El tamano de pagina debe ser un numero entero.' })
  @Min(1)
  @Max(maxPageSize, { message: `El tamano de pagina no puede superar ${maxPageSize}.` })
  @IsOptional()
  pageSize: number = defaultPageSize;

  @ApiPropertyOptional({ description: 'Texto libre de busqueda.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'], { message: 'El orden debe ser "asc" o "desc".' })
  @IsOptional()
  sortOrder: 'asc' | 'desc' = 'desc';
}

/** Desplazamiento y limite que espera Prisma. */
export function toSkipTake(query: PaginationQueryDto): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

/** Compone la respuesta paginada a partir de los elementos y el total. */
export function paginate<TItem>(
  items: TItem[],
  total: number,
  query: PaginationQueryDto,
): PaginatedData<TItem> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);

  const meta: PaginationMeta = {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    hasNextPage: query.page < totalPages,
    hasPreviousPage: query.page > 1,
  };

  return { items, meta };
}

/**
 * Construye una condicion `contains` insensible a mayusculas para varios
 * campos a la vez. Devuelve `undefined` si no hay busqueda, para no anadir un
 * `OR` vacio que Prisma interpretaria como "ningun resultado".
 */
export function searchFilter<TField extends string>(
  search: string | undefined,
  fields: TField[],
): { OR: Array<Record<TField, { contains: string; mode: 'insensitive' }>> } | undefined {
  const term = search?.trim();

  if (!term) return undefined;

  return {
    OR: fields.map(
      (field) =>
        ({ [field]: { contains: term, mode: 'insensitive' } }) as Record<
          TField,
          { contains: string; mode: 'insensitive' }
        >,
    ),
  };
}
