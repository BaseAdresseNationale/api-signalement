import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SourceTypeEnum } from './source.types';
import { AuthorInput } from '../../common/dto/author.dto';

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

  @ApiProperty({ required: false, nullable: true, type: AuthorInput })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthorInput)
  defaultAuthor?: AuthorInput;
}

export class UpdateSourceDTO {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nom?: string;

  @ApiProperty({ required: false, nullable: true, type: AuthorInput })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthorInput)
  defaultAuthor?: AuthorInput;
}
