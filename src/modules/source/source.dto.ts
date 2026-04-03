import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { SourceTypeEnum } from './source.types';

export class CreateSourceDTO {
  @ApiProperty({ required: true, nullable: false })
  @IsString()
  nom: string;

  @IsNotEmpty()
  @IsEnum(SourceTypeEnum)
  @ApiProperty({
    required: true,
    nullable: false,
    type: String,
    enum: SourceTypeEnum,
  })
  type: SourceTypeEnum;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsNumberString()
  @Length(14, 14)
  siret?: string;
}
