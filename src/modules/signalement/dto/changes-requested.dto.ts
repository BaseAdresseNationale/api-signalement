import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsNumber,
  Validate,
} from 'class-validator';
import { PositionDTO } from './position.dto';
import { ValidatorBal } from '../../../validators/bal.validator';

export class NumeroChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: Number })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  @Validate(ValidatorBal, ['numero'])
  numero: number;

  @ApiProperty({ required: false, nullable: false, type: String })
  @Validate(ValidatorBal, ['suffixe'])
  @IsOptional()
  suffixe?: string;

  @ApiProperty({ required: true, nullable: false, type: String })
  @Validate(ValidatorBal, ['voie_nom'])
  nomVoie: string;

  @ApiProperty({ required: false, nullable: false, type: String })
  @Validate(ValidatorBal, ['voie_nom'])
  @IsOptional()
  nomComplement?: string;

  @ApiProperty({ required: true, nullable: false, type: [String] })
  @Validate(ValidatorBal, ['cad_parcelles'])
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
  @Validate(ValidatorBal, ['voie_nom'])
  nom: string;

  @ApiProperty({ required: true, nullable: false, isArray: true, type: String })
  @IsArray()
  @Validate(ValidatorBal, ['cad_parcelles'])
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

export class VoieChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  @Validate(ValidatorBal, ['voie_nom'])
  nom: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  comment?: string;
}

export class DeleteNumeroChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  comment: string;
}
