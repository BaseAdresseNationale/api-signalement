import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SignalementSubmissionMode } from '../setting.type';

export class CommuneStatusDTO {
  @ApiProperty({ required: true, nullable: false })
  disabled: boolean;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty({
    required: false,
    type: String,
    enum: SignalementSubmissionMode,
  })
  @IsEnum(SignalementSubmissionMode)
  mode?: SignalementSubmissionMode;
}
