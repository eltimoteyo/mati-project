import {
  type CategoryRef,
  type ClientRef,
  type Message,
  type ProjectRef,
  type Ticket,
  TICKET_EVENT_TYPES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketDetail,
  type TicketEvent,
  type TicketEventType,
  type TicketPriority,
  type TicketStatus,
  type UserRef,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ClientRefDto } from '../../clients/clients.controller';
import { MessageResponseDto } from '../../messages/dto/message.dto';
import { ProjectRefDto } from '../../projects/projects.controller';

export class UserRefDto implements UserRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Administrador CONIT' })
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  avatar!: string | null;
}

export class CategoryRefDto implements CategoryRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Hosting y dominios' })
  name!: string;

  @ApiProperty({ example: 'BRAND' })
  color!: CategoryRef['color'];
}

export class TicketResponseDto implements Ticket {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 42, description: 'Correlativo asignado por la base de datos.' })
  number!: number;

  @ApiProperty({ example: 'CNT-0042', description: 'Codigo visible derivado del correlativo.' })
  code!: string;

  @ApiProperty({ example: 'Certificado SSL proximo a vencer' })
  subject!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: Object.values(TICKET_STATUSES) })
  status!: TicketStatus;

  @ApiProperty({ enum: Object.values(TICKET_PRIORITIES) })
  priority!: TicketPriority;

  @ApiProperty({ type: ClientRefDto })
  client!: ClientRef;

  @ApiPropertyOptional({ type: ProjectRefDto, nullable: true })
  project!: ProjectRef | null;

  @ApiPropertyOptional({ type: CategoryRefDto, nullable: true })
  category!: CategoryRef | null;

  @ApiPropertyOptional({ type: UserRefDto, nullable: true })
  assignee!: UserRef | null;

  @ApiPropertyOptional({ type: UserRefDto, nullable: true })
  createdBy!: UserRef | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  firstResponseAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  resolvedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  closedAt!: string | null;

  @ApiProperty({ example: 4, description: 'Mensajes en la conversacion.' })
  messageCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class TicketEventResponseDto implements TicketEvent {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({ enum: Object.values(TICKET_EVENT_TYPES) })
  type!: TicketEventType;

  @ApiPropertyOptional({ type: UserRefDto, nullable: true })
  actor!: UserRef | null;

  @ApiPropertyOptional({ nullable: true, example: 'Nuevo' })
  fromValue!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'En proceso' })
  toValue!: string | null;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class TicketDetailResponseDto extends TicketResponseDto implements TicketDetail {
  @ApiProperty({ type: [TicketEventResponseDto], description: 'Auditoria, de lo mas reciente a lo mas antiguo.' })
  events!: TicketEvent[];

  @ApiProperty({ type: [MessageResponseDto], description: 'Conversacion, en orden cronologico.' })
  messages!: Message[];
}
