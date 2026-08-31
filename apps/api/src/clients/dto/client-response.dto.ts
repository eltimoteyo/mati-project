import { CLIENT_STATUSES, type ClientStatus, type ClientWithCounts } from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ClientCountsDto {
  @ApiProperty({ example: 3 })
  projects!: number;

  @ApiProperty({ example: 27 })
  tickets!: number;

  @ApiProperty({ example: 4, description: 'Tickets en estado nuevo, en revision o en proceso.' })
  openTickets!: number;
}

export class ClientResponseDto implements ClientWithCounts {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Distribuidora Andina S.A.C.' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  taxId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  contactName!: string | null;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: Object.values(CLIENT_STATUSES) })
  status!: ClientStatus;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  userId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: ClientCountsDto })
  counts!: { projects: number; tickets: number; openTickets: number };
}
