import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { SignalementSubmissionMode } from '../setting.type';

export class CommuneStatusDTO {
  @ApiProperty({ required: true, nullable: false })
  @IsBoolean()
  disabled: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  message?: string;

  @ApiProperty({
    required: false,
    type: String,
    enum: SignalementSubmissionMode,
  })
  @IsEnum(SignalementSubmissionMode)
  @IsOptional()
  mode?: SignalementSubmissionMode;
}
