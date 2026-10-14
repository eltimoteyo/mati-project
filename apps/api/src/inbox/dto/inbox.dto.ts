import {
  type ClientRef,
  type InboxAiPauseInput,
  type InboxConversation,
  type InboxConversationDetail,
  type InboxMessage,
  type InboxTicketRef,
  TICKET_STATUSES,
  type TicketStatus,
  type UserRef,
  WHATSAPP_MESSAGE_DIRECTIONS,
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsappMessageDirection,
  type WhatsappMessageStatus,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { ClientRefDto } from '../../clients/clients.controller';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { UserRefDto } from '../../tickets/dto/ticket-response.dto';

const rules = VALIDATION_RULES.whatsapp;

export class InboxQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Solo conversaciones con mensajes sin leer.' })
  @Transform(({ value }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}

export class InboxReplyDto {
  @ApiProperty({
    minLength: rules.body.minLength,
    maxLength: rules.body.maxLength,
    example: 'Hola, ya estamos revisando el correo. Te escribimos en cuanto quede resuelto.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(rules.body.minLength, { message: 'El mensaje no puede estar vacio.' })
  @MaxLength(rules.body.maxLength, {
    message: `WhatsApp no admite mensajes de mas de ${rules.body.maxLength} caracteres.`,
  })
  body!: string;
}

export class InboxMessageResponseDto implements InboxMessage {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: Object.values(WHATSAPP_MESSAGE_DIRECTIONS) })
  direction!: WhatsappMessageDirection;

  @ApiProperty({ example: 'text', description: 'Tipo segun Meta: text, image, audio...' })
  type!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ enum: Object.values(WHATSAPP_MESSAGE_STATUSES) })
  status!: WhatsappMessageStatus;

  @ApiPropertyOptional({ nullable: true, description: 'Motivo de Meta si no se entrego.' })
  error!: string | null;

  @ApiPropertyOptional({ type: UserRefDto, nullable: true })
  author!: UserRef | null;

  @ApiProperty({ description: 'Escrito por la respuesta automatica de IA.' })
  aiGenerated!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class InboxAiPauseDto implements InboxAiPauseInput {
  @ApiProperty({ description: '`true` pausa la IA en la conversacion; `false` la reanuda.' })
  @IsBoolean({ message: 'El valor debe ser verdadero o falso.' })
  paused!: boolean;
}

class InboxLastMessageDto {
  @ApiProperty()
  body!: string;

  @ApiProperty({ enum: Object.values(WHATSAPP_MESSAGE_DIRECTIONS) })
  direction!: WhatsappMessageDirection;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class InboxConversationResponseDto implements InboxConversation {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '51936929213', description: 'Solo digitos, con codigo de pais.' })
  phone!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Nombre del perfil de WhatsApp.' })
  profileName!: string | null;

  @ApiPropertyOptional({ type: ClientRefDto, nullable: true })
  client!: ClientRef | null;

  @ApiPropertyOptional({ type: InboxLastMessageDto, nullable: true })
  lastMessage!: InboxConversation['lastMessage'];

  @ApiProperty({ format: 'date-time' })
  lastMessageAt!: string;

  @ApiProperty({ description: 'Si aun se le puede responder con texto libre.' })
  canReply!: boolean;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  replyWindowEndsAt!: string | null;

  @ApiProperty({ example: 2 })
  unreadCount!: number;

  @ApiProperty({ description: 'La respuesta automatica esta en pausa en esta conversacion.' })
  aiPaused!: boolean;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  aiPausedUntil!: string | null;
}

export class InboxTicketRefDto implements InboxTicketRef {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CNT-0042' })
  code!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty({ enum: Object.values(TICKET_STATUSES) })
  status!: TicketStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class InboxConversationDetailResponseDto
  extends InboxConversationResponseDto
  implements InboxConversationDetail
{
  @ApiProperty({ type: [InboxMessageResponseDto], description: 'En orden cronologico.' })
  messages!: InboxMessage[];

  @ApiProperty({ type: [InboxTicketRefDto], description: 'Del mas reciente al mas antiguo.' })
  tickets!: InboxTicketRef[];
}
