import { ApiProperty } from '@nestjs/swagger';
import { CommuneStatusDTO } from './commune-status.dto';
import { IsOptional } from 'class-validator';

export class CommuneSettingsDTO extends CommuneStatusDTO {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  filteredSources?: string[];
}
