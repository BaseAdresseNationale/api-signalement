import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty } from 'class-validator';
import { PositionTypeEnum } from '../schemas/position.schema';
import { Type } from 'class-transformer';
import { Position as PositionTurf } from '@turf/helpers';

export class PositionCoordinatesDTO {
  @ApiProperty({ required: true, nullable: false, type: Number, isArray: true })
  @IsArray()
  coordinates: PositionTurf;

  @ApiProperty({ required: true, nullable: false, type: String })
  @IsNotEmpty()
  type: 'Point';
}

export class PositionDTO {
  @ApiProperty({
    required: true,
    nullable: false,
    type: PositionCoordinatesDTO,
  })
  @IsNotEmpty()
  @Type(() => PositionCoordinatesDTO)
  point: PositionCoordinatesDTO;

  @ApiProperty({ required: true, nullable: false, type: String })
  @IsNotEmpty()
  @IsEnum(PositionTypeEnum)
  type: PositionTypeEnum;
}
