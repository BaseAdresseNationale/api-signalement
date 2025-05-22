import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SignalementSubmissionMode } from '../setting.type';

export class CommuneSettingsDTO {
  @ApiProperty({ required: true, nullable: false })
  disabled: boolean;

  @ApiProperty({ required: false, nullable: true })
  message?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    enum: SignalementSubmissionMode,
  })
  @IsEnum(SignalementSubmissionMode)
  mode?: SignalementSubmissionMode;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  filteredSources?: string[];
}
