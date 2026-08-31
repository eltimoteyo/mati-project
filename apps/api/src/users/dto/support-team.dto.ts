import { type SupportAgent, USER_STATUSES, type UserStatus } from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class WorkloadDto {
  @ApiProperty({ example: 4, description: 'Tickets asignados en estados abiertos.' })
  open!: number;

  @ApiProperty({ example: 1, description: 'De los abiertos, cuantos son criticos.' })
  critical!: number;

  @ApiProperty({ example: 12, description: 'Resueltos en los ultimos 30 dias.' })
  resolvedLast30Days!: number;

  @ApiProperty({ example: 87, description: 'Total historico asignado.' })
  total!: number;
}

export class SupportAgentDto implements SupportAgent {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Administrador CONIT' })
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiPropertyOptional({ nullable: true })
  avatar!: string | null;

  @ApiProperty({ enum: Object.values(USER_STATUSES) })
  status!: UserStatus;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  lastLoginAt!: string | null;

  @ApiProperty({ type: WorkloadDto })
  workload!: SupportAgent['workload'];
}

/** Respuesta del endpoint de equipo. */
export interface SupportTeamResponse {
  agents: SupportAgent[];
  unassigned: number;
}

export class SupportTeamResponseDto implements SupportTeamResponse {
  @ApiProperty({ type: [SupportAgentDto] })
  agents!: SupportAgent[];

  @ApiProperty({ example: 3, description: 'Tickets abiertos sin responsable asignado.' })
  unassigned!: number;
}
