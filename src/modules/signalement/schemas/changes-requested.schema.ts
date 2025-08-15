import { Position } from './position.schema';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  Validate,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ValidatorBal } from '../../../validators/bal.validator';

export class ChangesRequested {
  @ApiProperty({ required: false, type: Number })
  @IsNumber()
  @Transform(({ value }) => Number(value))
  @Validate(ValidatorBal, ['numero'])
  @IsOptional()
  numero?: number;

  @ApiProperty({ required: false })
  @Validate(ValidatorBal, ['suffixe'])
  @IsOptional()
  suffixe?: string;

  @ApiProperty({ required: false, type: [Position] })
  @IsArray()
  @IsOptional()
  positions?: Position[];

  @ApiProperty({ required: false, type: [String] })
  @Validate(ValidatorBal, ['cad_parcelles'])
  @IsArray()
  @IsOptional()
  parcelles?: string[];

  @ApiProperty({ required: false, type: String })
  @Validate(ValidatorBal, ['voie_nom'])
  @IsOptional()
  nomVoie?: string;

  @ApiProperty({ required: false, type: String })
  @ValidateIf(({ nomComplement }) => Boolean(nomComplement))
  @Validate(ValidatorBal, ['voie_nom'], {})
  @IsOptional()
  nomComplement?: string;

  @ApiProperty({ required: false, type: String })
  @Validate(ValidatorBal, ['voie_nom'])
  @IsOptional()
  nom?: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  comment?: string;
}
