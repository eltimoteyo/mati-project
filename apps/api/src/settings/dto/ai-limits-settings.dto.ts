import {
  AI_EFFORT_LEVELS,
  type AiEffort,
  type AiLimitsSettings,
  type UpdateAiLimitsSettingsInput,
} from '@conit/types';
import { VALIDATION_RULES } from '@conit/validation';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

const rules = VALIDATION_RULES.aiLimits;
const EFFORTS = Object.values(AI_EFFORT_LEVELS);
const range = (label: string, limits: { min: number; max: number }) =>
  `${label} debe estar entre ${limits.min} y ${limits.max}.`;

export class UpdateAiLimitsSettingsDto implements UpdateAiLimitsSettingsInput {
  @ApiPropertyOptional({ enum: EFFORTS, description: 'Razonamiento del agente de WhatsApp.' })
  @IsOptional()
  @IsIn(EFFORTS, { message: 'Nivel de razonamiento no valido.' })
  agentEffort?: AiEffort;

  @ApiPropertyOptional({ enum: EFFORTS, description: 'Razonamiento en tareas cortas.' })
  @IsOptional()
  @IsIn(EFFORTS, { message: 'Nivel de razonamiento no valido.' })
  quickEffort?: AiEffort;

  @ApiPropertyOptional({ minimum: rules.agentMaxTokens.min, maximum: rules.agentMaxTokens.max })
  @IsOptional()
  @IsInt({ message: 'Debe ser un numero entero.' })
  @Min(rules.agentMaxTokens.min, { message: range('Los tokens del agente', rules.agentMaxTokens) })
  @Max(rules.agentMaxTokens.max, { message: range('Los tokens del agente', rules.agentMaxTokens) })
  agentMaxTokens?: number;

  @ApiPropertyOptional({
    minimum: rules.minResponseTokens.min,
    maximum: rules.minResponseTokens.max,
  })
  @IsOptional()
  @IsInt({ message: 'Debe ser un numero entero.' })
  @Min(rules.minResponseTokens.min, {
    message: range('Los tokens minimos', rules.minResponseTokens),
  })
  @Max(rules.minResponseTokens.max, {
    message: range('Los tokens minimos', rules.minResponseTokens),
  })
  minResponseTokens?: number;

  @ApiPropertyOptional({
    minimum: rules.turnTimeoutSeconds.min,
    maximum: rules.turnTimeoutSeconds.max,
  })
  @IsOptional()
  @IsInt({ message: 'Debe ser un numero entero.' })
  @Min(rules.turnTimeoutSeconds.min, {
    message: range('El tiempo por turno', rules.turnTimeoutSeconds),
  })
  @Max(rules.turnTimeoutSeconds.max, {
    message: range('El tiempo por turno', rules.turnTimeoutSeconds),
  })
  turnTimeoutSeconds?: number;

  @ApiPropertyOptional({ minimum: rules.maxToolRounds.min, maximum: rules.maxToolRounds.max })
  @IsOptional()
  @IsInt({ message: 'Debe ser un numero entero.' })
  @Min(rules.maxToolRounds.min, { message: range('Las vueltas', rules.maxToolRounds) })
  @Max(rules.maxToolRounds.max, { message: range('Las vueltas', rules.maxToolRounds) })
  maxToolRounds?: number;

  @ApiPropertyOptional({
    minimum: rules.concurrentConversations.min,
    maximum: rules.concurrentConversations.max,
  })
  @IsOptional()
  @IsInt({ message: 'Debe ser un numero entero.' })
  @Min(rules.concurrentConversations.min, {
    message: range('Las conversaciones a la vez', rules.concurrentConversations),
  })
  @Max(rules.concurrentConversations.max, {
    message: range('Las conversaciones a la vez', rules.concurrentConversations),
  })
  concurrentConversations?: number;

  @ApiPropertyOptional({
    minimum: rules.replyDelaySeconds.min,
    maximum: rules.replyDelaySeconds.max,
  })
  @IsOptional()
  @IsInt({ message: 'Debe ser un numero entero.' })
  @Min(rules.replyDelaySeconds.min, { message: range('La espera', rules.replyDelaySeconds) })
  @Max(rules.replyDelaySeconds.max, { message: range('La espera', rules.replyDelaySeconds) })
  replyDelaySeconds?: number;

  @ApiPropertyOptional({
    minimum: rules.maxRepliesPerHour.min,
    maximum: rules.maxRepliesPerHour.max,
  })
  @IsOptional()
  @IsInt({ message: 'Debe ser un numero entero.' })
  @Min(rules.maxRepliesPerHour.min, {
    message: range('Las respuestas por hora', rules.maxRepliesPerHour),
  })
  @Max(rules.maxRepliesPerHour.max, {
    message: range('Las respuestas por hora', rules.maxRepliesPerHour),
  })
  maxRepliesPerHour?: number;

  @ApiPropertyOptional({
    minimum: rules.dailyBudgetUsd.min,
    maximum: rules.dailyBudgetUsd.max,
    description: '0 desactiva el limite.',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Debe ser un numero.' })
  @Min(rules.dailyBudgetUsd.min, { message: range('El presupuesto', rules.dailyBudgetUsd) })
  @Max(rules.dailyBudgetUsd.max, { message: range('El presupuesto', rules.dailyBudgetUsd) })
  dailyBudgetUsd?: number;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({}, { message: 'Debe ser un numero.' })
  @Min(rules.priceUsdPerMillion.min, { message: range('El precio', rules.priceUsdPerMillion) })
  @Max(rules.priceUsdPerMillion.max, { message: range('El precio', rules.priceUsdPerMillion) })
  inputPriceUsdPerMillion?: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({}, { message: 'Debe ser un numero.' })
  @Min(rules.priceUsdPerMillion.min, { message: range('El precio', rules.priceUsdPerMillion) })
  @Max(rules.priceUsdPerMillion.max, { message: range('El precio', rules.priceUsdPerMillion) })
  outputPriceUsdPerMillion?: number | null;
}

export class AiLimitsSettingsResponseDto implements AiLimitsSettings {
  @ApiProperty({ enum: EFFORTS })
  agentEffort!: AiEffort;

  @ApiProperty({ enum: EFFORTS })
  quickEffort!: AiEffort;

  @ApiProperty()
  agentMaxTokens!: number;

  @ApiProperty()
  minResponseTokens!: number;

  @ApiProperty()
  turnTimeoutSeconds!: number;

  @ApiProperty()
  maxToolRounds!: number;

  @ApiProperty()
  concurrentConversations!: number;

  @ApiProperty()
  replyDelaySeconds!: number;

  @ApiProperty()
  maxRepliesPerHour!: number;

  @ApiProperty()
  dailyBudgetUsd!: number;

  @ApiProperty({ nullable: true, type: Number })
  inputPriceUsdPerMillion!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  outputPriceUsdPerMillion!: number | null;
}
