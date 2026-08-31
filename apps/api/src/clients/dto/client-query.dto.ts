import { CLIENT_STATUSES, type ClientStatus } from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export const CLIENT_SORT_FIELDS = ['name', 'email', 'createdAt', 'updatedAt'] as const;

export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number];

export class ClientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Object.values(CLIENT_STATUSES) })
  @IsOptional()
  @IsEnum(CLIENT_STATUSES)
  status?: ClientStatus;

  @ApiPropertyOptional({ enum: CLIENT_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(CLIENT_SORT_FIELDS, { message: 'No se puede ordenar por ese campo.' })
  sortBy: ClientSortField = 'name';
}
