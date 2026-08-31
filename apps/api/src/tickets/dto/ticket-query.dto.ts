import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export const TICKET_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'priority',
  'status',
  'number',
] as const;

export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

export class TicketQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Object.values(TICKET_STATUSES) })
  @IsOptional()
  @IsEnum(TICKET_STATUSES)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: Object.values(TICKET_PRIORITIES) })
  @IsOptional()
  @IsEnum(TICKET_PRIORITIES)
  priority?: TicketPriority;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Limita a los estados nuevo, en revision y en proceso.' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  openOnly?: boolean;

  @ApiPropertyOptional({ enum: TICKET_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(TICKET_SORT_FIELDS, { message: 'No se puede ordenar por ese campo.' })
  sortBy: TicketSortField = 'createdAt';
}
