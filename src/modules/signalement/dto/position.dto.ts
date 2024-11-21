import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { PositionTypeEnum } from '../schemas/position.schema';
import { Type } from 'class-transformer';
import { Position as PositionTurf } from '@turf/helpers';

enum _PositionTypeEnum {
  POINT = 'Point',
}

export class PositionCoordinatesDTO {
  @ApiProperty({ required: true, nullable: false, type: Number, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  coordinates: PositionTurf;

  @ApiProperty({ required: true, nullable: false, type: String })
  @IsEnum(_PositionTypeEnum)
  type: _PositionTypeEnum.POINT;
}

export class PositionDTO {
  @ApiProperty({
    required: true,
    nullable: false,
    type: PositionCoordinatesDTO,
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PositionCoordinatesDTO)
  point: PositionCoordinatesDTO;

  @ApiProperty({ required: true, nullable: false, enum: PositionTypeEnum })
  @IsNotEmpty()
  @IsEnum(PositionTypeEnum)
  type: PositionTypeEnum;
}
