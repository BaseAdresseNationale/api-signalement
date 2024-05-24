import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { SourceTypeEnum } from './source.types';

export class CreateSourceDTO {
  @ApiProperty({ required: true, nullable: false })
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
}
