import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsString,
  Length,
  ValidateIf,
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
  @ValidateIf((o) => o.type === SourceTypeEnum.PRIVATE || o.siret !== undefined)
  @IsNotEmpty({ message: 'siret is required for PRIVATE sources' })
  @IsNumberString()
  @Length(14, 14)
  siret?: string;
}
