import {
  type Message,
  type PortalProfile,
  type PortalTicket,
  type PortalTicketCounts,
  type PortalTicketDetail,
  type PortalTimelineEntry,
  type ProjectRef,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { MessageResponseDto } from '../../messages/dto/message.dto';
import { ProjectRefDto } from '../../projects/projects.controller';

class PortalUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  avatar!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  lastLoginAt!: string | null;
}

class PortalClientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
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
}

class PortalTicketCountsDto implements PortalTicketCounts {
  @ApiProperty({ description: 'Incidencias en curso.' })
  open!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ description: 'Abiertas que aun no tienen primera respuesta.' })
  awaitingResponse!: number;
}

export class PortalProfileDto implements PortalProfile {
  @ApiProperty({ type: PortalUserDto })
  user!: PortalProfile['user'];

  @ApiProperty({ type: PortalClientDto })
  client!: PortalProfile['client'];

  @ApiProperty({ type: [ProjectRefDto], description: 'Servicios contratados y activos.' })
  services!: ProjectRef[];

  @ApiProperty({ type: PortalTicketCountsDto })
  counts!: PortalTicketCounts;
}

export class PortalTicketDto implements PortalTicket {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CNT-0042' })
  code!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty({ enum: Object.values(TICKET_STATUSES) })
  status!: TicketStatus;

  @ApiProperty({ enum: Object.values(TICKET_PRIORITIES) })
  priority!: TicketPriority;

  @ApiPropertyOptional({ type: ProjectRefDto, nullable: true })
  service!: ProjectRef | null;

  @ApiPropertyOptional({ nullable: true, description: 'Quien atiende la incidencia.' })
  attendedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  firstResponseAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  resolvedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ description: 'Mensajes visibles para el cliente.' })
  messageCount!: number;
}

class PortalTimelineEntryDto implements PortalTimelineEntry {
  @ApiProperty({ enum: Object.values(TICKET_STATUSES) })
  status!: TicketStatus;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  at!: string | null;
}

export class PortalTicketDetailDto extends PortalTicketDto implements PortalTicketDetail {
  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [MessageResponseDto], description: 'Solo los mensajes publicos.' })
  messages!: Message[];

  @ApiProperty({ type: [PortalTimelineEntryDto], description: 'Cambios de estado.' })
  timeline!: PortalTimelineEntry[];
}
