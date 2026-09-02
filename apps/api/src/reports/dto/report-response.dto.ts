import {
  type ReportAgentPerformance,
  type ReportCount,
  type ReportNamedCount,
  type ReportPeriod,
  type ReportSummary,
  type ReportTimes,
  type ReportTotals,
  type ReportVolumePoint,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ReportPeriodDto implements ReportPeriod {
  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  @ApiProperty({ example: 30 })
  days!: number;
}

class ReportTotalsDto implements ReportTotals {
  @ApiProperty({ description: 'Tickets creados dentro del periodo.' })
  created!: number;

  @ApiProperty({ description: 'Tickets resueltos dentro del periodo.' })
  resolved!: number;

  @ApiProperty({ description: 'Abiertos en este momento.' })
  open!: number;

  @ApiProperty({ description: 'Resueltos que volvieron a abrirse.' })
  reopened!: number;
}

class ReportTimesDto implements ReportTimes {
  @ApiPropertyOptional({ nullable: true, description: 'Minutos medios hasta la primera respuesta.' })
  firstResponseMinutes!: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Minutos medios hasta la resolucion.' })
  resolutionMinutes!: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Porcentaje dentro del objetivo.' })
  responseWithinTargetPct!: number | null;

  @ApiPropertyOptional({ nullable: true })
  resolutionWithinTargetPct!: number | null;

  @ApiProperty({ description: 'Tickets con una categoria que fija objetivos.' })
  measuredAgainstTarget!: number;
}

class ReportVolumePointDto implements ReportVolumePoint {
  @ApiProperty({ example: '2026-08-31' })
  date!: string;

  @ApiProperty()
  created!: number;

  @ApiProperty()
  resolved!: number;
}

class ReportStatusCountDto implements ReportCount<TicketStatus> {
  @ApiProperty({ enum: Object.values(TICKET_STATUSES) })
  key!: TicketStatus;

  @ApiProperty()
  count!: number;

  @ApiProperty({ example: 42.5 })
  percentage!: number;
}

class ReportPriorityCountDto implements ReportCount<TicketPriority> {
  @ApiProperty({ enum: Object.values(TICKET_PRIORITIES) })
  key!: TicketPriority;

  @ApiProperty()
  count!: number;

  @ApiProperty({ example: 12.5 })
  percentage!: number;
}

class ReportNamedCountDto implements ReportNamedCount {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  percentage!: number;
}

class ReportAgentPerformanceDto implements ReportAgentPerformance {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  assigned!: number;

  @ApiProperty()
  resolved!: number;

  @ApiPropertyOptional({ nullable: true })
  averageResolutionMinutes!: number | null;
}

export class ReportSummaryDto implements ReportSummary {
  @ApiProperty({ type: ReportPeriodDto })
  period!: ReportPeriod;

  @ApiProperty({ type: ReportTotalsDto })
  totals!: ReportTotals;

  @ApiProperty({ type: ReportTimesDto })
  times!: ReportTimes;

  @ApiProperty({ type: [ReportVolumePointDto] })
  volume!: ReportVolumePoint[];

  @ApiProperty({ type: [ReportStatusCountDto] })
  byStatus!: ReportCount<TicketStatus>[];

  @ApiProperty({ type: [ReportPriorityCountDto] })
  byPriority!: ReportCount<TicketPriority>[];

  @ApiProperty({ type: [ReportNamedCountDto] })
  byClient!: ReportNamedCount[];

  @ApiProperty({ type: [ReportNamedCountDto] })
  byCategory!: ReportNamedCount[];

  @ApiProperty({ type: [ReportAgentPerformanceDto] })
  byAgent!: ReportAgentPerformance[];
}
