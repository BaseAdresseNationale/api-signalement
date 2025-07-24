import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { PositionDTO } from './position.dto';

export class NumeroChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: Number })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  numero: number;

  @ApiProperty({ required: false, nullable: false, type: String })
  @IsOptional()
  suffixe?: string;

  @ApiProperty({ required: true, nullable: false, type: String })
  nomVoie: string;

  @ApiProperty({ required: false, nullable: false, type: String })
  @IsOptional()
  nomComplement?: string;

  @ApiProperty({ required: true, nullable: false, type: [String] })
  @IsArray()
  parcelles: string[];

  @ApiProperty({ required: true, nullable: false, type: [PositionDTO] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayNotEmpty()
  @Type(() => PositionDTO)
  positions: PositionDTO[];

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  comment?: string;
}

export class ToponymeChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  nom: string;

  @ApiProperty({ required: true, nullable: false, isArray: true, type: String })
  @IsArray()
  parcelles: string[];

  @ApiProperty({
    required: true,
    nullable: false,
    isArray: true,
    type: PositionDTO,
  })
  @IsArray()
  @Type(() => Array<PositionDTO>)
  positions: PositionDTO[];

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  comment?: string;
}

export class VoieChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  nom: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  comment?: string;
}

export class DeleteNumeroChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  comment: string;
}
