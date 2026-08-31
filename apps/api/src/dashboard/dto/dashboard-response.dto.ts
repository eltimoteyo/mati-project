import {
  type DashboardMetric,
  type DashboardSummary,
  SERVICE_TYPES,
  type ServiceDistributionItem,
  type ServiceType,
  type Ticket,
  TICKET_STATUSES,
  type TicketStatus,
  type TicketVolumePoint,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TicketResponseDto } from '../../tickets/dto/ticket-response.dto';

class DashboardMetricDto implements DashboardMetric {
  @ApiProperty({ enum: [...Object.values(TICKET_STATUSES), 'CRITICAL'] })
  key!: TicketStatus | 'CRITICAL';

  @ApiProperty({ example: 18 })
  value!: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 12.5,
    description:
      'Variacion porcentual frente al periodo anterior. `null` cuando no existe una base ' +
      'de comparacion fiable para esa metrica.',
  })
  delta!: number | null;
}

class TicketVolumePointDto implements TicketVolumePoint {
  @ApiProperty({ example: '2026-08-25' })
  date!: string;

  @ApiProperty({ example: 12 })
  created!: number;

  @ApiProperty({ example: 9 })
  resolved!: number;
}

class ServiceDistributionItemDto implements ServiceDistributionItem {
  @ApiProperty({ enum: Object.values(SERVICE_TYPES) })
  type!: ServiceType;

  @ApiProperty({ example: 34 })
  count!: number;

  @ApiProperty({ example: 24.8 })
  percentage!: number;
}

class DashboardTotalsDto {
  @ApiProperty({ example: 12 })
  clients!: number;

  @ApiProperty({ example: 31 })
  projects!: number;

  @ApiProperty({ example: 48 })
  openTickets!: number;
}

export class DashboardSummaryDto implements DashboardSummary {
  @ApiProperty({ type: [DashboardMetricDto] })
  metrics!: DashboardMetric[];

  @ApiProperty({ type: [TicketVolumePointDto], description: 'Serie de los ultimos 14 dias.' })
  volume!: TicketVolumePoint[];

  @ApiProperty({ type: [ServiceDistributionItemDto] })
  distribution!: ServiceDistributionItem[];

  @ApiProperty({ type: [TicketResponseDto] })
  recentTickets!: Ticket[];

  @ApiProperty({ type: DashboardTotalsDto })
  totals!: { clients: number; projects: number; openTickets: number };
}
