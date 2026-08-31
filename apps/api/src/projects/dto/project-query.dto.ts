import {
  PROJECT_STATUSES,
  type ProjectStatus,
  SERVICE_TYPES,
  type ServiceType,
} from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export const PROJECT_SORT_FIELDS = ['name', 'type', 'expiresAt', 'createdAt'] as const;

export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export class ProjectQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiPropertyOptional({ enum: Object.values(SERVICE_TYPES) })
  @IsOptional()
  @IsEnum(SERVICE_TYPES)
  type?: ServiceType;

  @ApiPropertyOptional({ enum: Object.values(PROJECT_STATUSES) })
  @IsOptional()
  @IsEnum(PROJECT_STATUSES)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Solo servicios que vencen en los proximos 30 dias.',
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  expiringSoon?: boolean;

  @ApiPropertyOptional({ enum: PROJECT_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(PROJECT_SORT_FIELDS, { message: 'No se puede ordenar por ese campo.' })
  sortBy: ProjectSortField = 'name';
}
