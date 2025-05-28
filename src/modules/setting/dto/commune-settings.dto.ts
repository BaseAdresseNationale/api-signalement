import { ApiProperty } from '@nestjs/swagger';
import { CommuneStatusDTO } from './commune-status.dto';

export class CommuneSettingsDTO extends CommuneStatusDTO {
  @ApiProperty({ required: false, type: [String] })
  filteredSources?: string[];
}
