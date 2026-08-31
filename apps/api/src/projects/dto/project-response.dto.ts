import {
  type ClientRef,
  PROJECT_STATUSES,
  type ProjectStatus,
  type ProjectWithClient,
  SERVICE_TYPES,
  type ServiceType,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ClientRefDto } from '../../clients/clients.controller';

class ProjectCountsDto {
  @ApiProperty({ example: 8 })
  tickets!: number;
}

export class ProjectResponseDto implements ProjectWithClient {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  clientId!: string;

  @ApiProperty({ example: 'Portal institucional' })
  name!: string;

  @ApiProperty({ enum: Object.values(SERVICE_TYPES) })
  type!: ServiceType;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://cliente.com' })
  url!: string | null;

  @ApiProperty({ enum: Object.values(PROJECT_STATUSES) })
  status!: ProjectStatus;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  startedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  expiresAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: ClientRefDto })
  client!: ClientRef;

  @ApiProperty({ type: ProjectCountsDto })
  counts!: { tickets: number };
}
