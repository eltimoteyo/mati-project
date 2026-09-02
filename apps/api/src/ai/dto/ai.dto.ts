import {
  AI_REPLY_TONES,
  type AiClassification,
  type AiReplyTone,
  type AiStatus,
  type AiSuggestion,
  type AiSummary,
  TICKET_PRIORITIES,
  type TicketPriority,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SuggestReplyDto {
  @ApiPropertyOptional({
    enum: Object.values(AI_REPLY_TONES),
    default: AI_REPLY_TONES.NEUTRAL,
  })
  @IsOptional()
  @IsEnum(AI_REPLY_TONES, { message: 'El tono seleccionado no es valido.' })
  tone?: AiReplyTone;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Indicaciones concretas para esta respuesta.',
    example: 'Explicale que ya renovamos el certificado y que puede tardar 10 minutos.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}

export class AiStatusDto implements AiStatus {
  @ApiProperty({ description: 'Falso si no hay proveedor configurado.' })
  enabled!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'anthropic/claude-3.5-haiku' })
  model!: string | null;
}

export class AiSuggestionDto implements AiSuggestion {
  @ApiProperty({ description: 'Propuesta de respuesta, pendiente de revision.' })
  content!: string;

  @ApiProperty()
  model!: string;
}

export class AiClassificationDto implements AiClassification {
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  categoryId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ enum: Object.values(TICKET_PRIORITIES) })
  priority!: TicketPriority;

  @ApiProperty({ example: 'El correo corporativo no llega a ningun buzon del dominio.' })
  reasoning!: string;

  @ApiProperty()
  model!: string;
}

export class AiSummaryDto implements AiSummary {
  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: [String] })
  nextSteps!: string[];

  @ApiProperty()
  model!: string;
}
