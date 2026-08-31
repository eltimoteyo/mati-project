import { CATEGORY_STATUSES, type CategoryStatus } from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Columnas por las que se permite ordenar el listado de categorias. */
export const CATEGORY_SORT_FIELDS = ['name', 'createdAt', 'updatedAt'] as const;

export type CategorySortField = (typeof CATEGORY_SORT_FIELDS)[number];

export class CategoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Object.values(CATEGORY_STATUSES) })
  @IsOptional()
  @IsEnum(CATEGORY_STATUSES)
  status?: CategoryStatus;

  @ApiPropertyOptional({ enum: CATEGORY_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(CATEGORY_SORT_FIELDS, { message: 'No se puede ordenar por ese campo.' })
  sortBy: CategorySortField = 'name';
}
