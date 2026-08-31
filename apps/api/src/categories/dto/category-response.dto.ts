import {
  CATEGORY_COLORS,
  CATEGORY_STATUSES,
  type CategoryColor,
  type CategoryStatus,
  type CategoryWithCounts,
} from '@conit/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CategoryCountsDto {
  @ApiProperty({ example: 12, description: 'Tickets clasificados en esta categoria.' })
  tickets!: number;
}

export class CategoryResponseDto implements CategoryWithCounts {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Hosting y dominios' })
  name!: string;

  @ApiProperty({ example: 'hosting-y-dominios' })
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: Object.values(CATEGORY_COLORS) })
  color!: CategoryColor;

  @ApiPropertyOptional({ nullable: true, example: 60 })
  responseTimeMinutes!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 480 })
  resolutionTimeMinutes!: number | null;

  @ApiProperty({ enum: Object.values(CATEGORY_STATUSES) })
  status!: CategoryStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: CategoryCountsDto })
  counts!: { tickets: number };
}
