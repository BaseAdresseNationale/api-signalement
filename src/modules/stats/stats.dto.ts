import { ApiProperty } from '@nestjs/swagger';
import { SignalementStatusEnum } from '../signalement/signalement.types';

export class MonthlyReportCountsDTO {
  @ApiProperty({ required: true, nullable: false, type: Number })
  created: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  processed: number;
}

export class StatsDTO {
  @ApiProperty({ required: true, nullable: false, type: Number })
  total: number;

  @ApiProperty({ required: true, nullable: false, type: Object })
  fromSources: Record<string, Record<SignalementStatusEnum, number>>;

  @ApiProperty({ required: true, nullable: false, type: Object })
  processedBy: Record<string, Record<SignalementStatusEnum, number>>;

  // Clé au format 'YYYY-MM' -> nombre de reports créés / traités ce mois-là
  @ApiProperty({ required: true, nullable: false, type: Object })
  byMonth: Record<string, MonthlyReportCountsDTO>;
}

export class CombinedStatsDTO {
  @ApiProperty({ required: true, nullable: false, type: Object })
  alertStats: StatsDTO;

  @ApiProperty({ required: true, nullable: false, type: Object })
  signalementStats: StatsDTO;
}
