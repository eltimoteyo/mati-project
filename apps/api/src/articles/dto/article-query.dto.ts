import { ARTICLE_SORT_FIELDS, type ArticleSortField } from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ArticleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'true solo publicados, false solo borradores. Omitido devuelve ambos.',
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;

    return undefined;
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ enum: ARTICLE_SORT_FIELDS, default: 'updatedAt' })
  @IsOptional()
  @IsIn(ARTICLE_SORT_FIELDS, { message: 'No se puede ordenar por ese campo.' })
  sortBy: ArticleSortField = 'updatedAt';
}
