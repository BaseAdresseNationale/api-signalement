import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsArray } from 'class-validator';
import { PositionDTO } from './position.dto';

export class NumeroChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  numero: string;

  @ApiProperty({ required: false, nullable: false, type: String })
  @IsOptional()
  suffixe?: string;

  @ApiProperty({ required: true, nullable: false, type: String })
  nomVoie: string;

  @ApiProperty({ required: true, nullable: false, type: String })
  @IsArray()
  parcelles: string[];

  @ApiProperty({ required: true, nullable: false, type: PositionDTO })
  @IsArray()
  @Type(() => PositionDTO)
  positions: PositionDTO[];
}

export class ToponymeChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  nom: string;
}

export class VoieChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  nom: string;
}

export class DeleteNumeroChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  comment: string;
}
