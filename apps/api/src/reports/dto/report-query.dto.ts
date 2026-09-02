import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ReportQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Inicio del periodo. Por defecto, hace 30 dias.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio no es valida.' })
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Fin del periodo. Por defecto, hoy.' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin no es valida.' })
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  clientId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}
