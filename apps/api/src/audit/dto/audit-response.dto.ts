import {
  type AuditEntry,
  type AuditSummary,
  type AuditTicketRef,
  type AuditTypeCount,
  TICKET_EVENT_TYPES,
  type TicketEventType,
  type UserRef,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserRefDto } from '../../tickets/dto/ticket-response.dto';

class AuditTicketRefDto implements AuditTicketRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CNT-0042' })
  code!: string;

  @ApiProperty({ example: 'El certificado SSL caduca esta semana' })
  subject!: string;
}

export class AuditEntryDto implements AuditEntry {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({ type: AuditTicketRefDto })
  ticket!: AuditTicketRef;

  @ApiProperty({ enum: Object.values(TICKET_EVENT_TYPES) })
  type!: TicketEventType;

  @ApiPropertyOptional({ type: UserRefDto, nullable: true })
  actor!: UserRef | null;

  @ApiPropertyOptional({ nullable: true, example: 'NEW' })
  fromValue!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'IN_PROGRESS' })
  toValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

class AuditTypeCountDto implements AuditTypeCount {
  @ApiProperty({ enum: Object.values(TICKET_EVENT_TYPES) })
  type!: TicketEventType;

  @ApiProperty({ example: 18 })
  count!: number;
}

export class AuditSummaryDto implements AuditSummary {
  @ApiProperty({ example: 124, description: 'Eventos que cumplen el filtro aplicado.' })
  total!: number;

  @ApiProperty({ example: 31, description: 'Tickets distintos afectados.' })
  tickets!: number;

  @ApiProperty({ example: 4, description: 'Usuarios distintos que provocaron algun evento.' })
  actors!: number;

  @ApiProperty({ type: [AuditTypeCountDto] })
  byType!: AuditTypeCount[];
}
