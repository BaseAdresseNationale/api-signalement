import { ApiProperty } from '@nestjs/swagger';
import { SignalementStatusEnum } from '../signalement.types';

export class SignalementStatsDTO {
  @ApiProperty({ required: true, nullable: false, type: Number })
  total: number;

  @ApiProperty({ required: true, nullable: false, type: Object })
  fromSources: Record<string, Record<SignalementStatusEnum, number>>;

  @ApiProperty({ required: true, nullable: false, type: Object })
  processedBy: Record<string, Record<SignalementStatusEnum, number>>;
}
