import { ApiProperty } from '@nestjs/swagger';
import { SignalementStatusEnum } from '../signalement/signalement.types';

export class MonthlyReportCountsDTO {
  @ApiProperty({
    required: true,
    nullable: false,
    type: String,
    enum: ['created', 'processed'],
  })
  type: 'created' | 'processed';

  @ApiProperty({ required: true, nullable: false, type: Number })
  count: number;

  @ApiProperty({ required: true, nullable: false, type: String })
  date: string;
}

export class StatsDTO {
  @ApiProperty({ required: true, nullable: false, type: Number })
  total: number;

  @ApiProperty({ required: true, nullable: false, type: Object })
  fromSources: Record<string, Record<SignalementStatusEnum, number>>;

  @ApiProperty({ required: true, nullable: false, type: Object })
  processedBy: Record<string, Record<SignalementStatusEnum, number>>;

  @ApiProperty({
    required: true,
    nullable: false,
    type: Array<MonthlyReportCountsDTO>,
  })
  byMonth: Array<MonthlyReportCountsDTO>;
}

export class CombinedStatsDTO {
  @ApiProperty({ required: true, nullable: false, type: Object })
  alertStats: StatsDTO;

  @ApiProperty({ required: true, nullable: false, type: Object })
  signalementStats: StatsDTO;
}
