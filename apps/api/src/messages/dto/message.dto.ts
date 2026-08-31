import {
  type Message,
  MESSAGE_VISIBILITIES,
  type MessageVisibility,
  type UserRef,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { UserRefDto } from '../../tickets/dto/ticket-response.dto';

const rules = VALIDATION_RULES.message;

export class CreateMessageDto {
  @ApiProperty({
    minLength: rules.body.minLength,
    maxLength: rules.body.maxLength,
    example: 'Hemos renovado el certificado; queda operativo en unos minutos.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(rules.body.minLength, { message: 'El mensaje no puede estar vacio.' })
  @MaxLength(rules.body.maxLength)
  body!: string;

  @ApiPropertyOptional({
    enum: Object.values(MESSAGE_VISIBILITIES),
    default: MESSAGE_VISIBILITIES.PUBLIC,
    description: 'PUBLIC lo vera el cliente en el portal; INTERNAL es solo para soporte.',
  })
  @IsOptional()
  @IsEnum(MESSAGE_VISIBILITIES, { message: 'La visibilidad seleccionada no es valida.' })
  visibility?: MessageVisibility;
}

/** La visibilidad no se cambia despues de enviar: ya se mostro (o no) al cliente. */
export class UpdateMessageDto {
  @ApiProperty({ minLength: rules.body.minLength, maxLength: rules.body.maxLength })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(rules.body.minLength, { message: 'El mensaje no puede estar vacio.' })
  @MaxLength(rules.body.maxLength)
  body!: string;
}

export class MessageResponseDto implements Message {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ enum: Object.values(MESSAGE_VISIBILITIES) })
  visibility!: MessageVisibility;

  @ApiPropertyOptional({ type: UserRefDto, nullable: true })
  author!: UserRef | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  readAt!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  editedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
