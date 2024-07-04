import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsEnum,
  IsNotEmpty,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Point as PointTurf, Position as PositionTurf } from '@turf/helpers';
import { PointValidator } from '../../../validators/point.validator';

export enum PositionTypeEnum {
  ENTREE = 'entrée',
  BATIMENT = 'bâtiment',
  CAGE_ESCALIER = 'cage d’escalier',
  LOGEMENT = 'logement',
  SERVICE_TECHNIQUE = 'service technique',
  DELIVRANCE_POSTALE = 'délivrance postale',
  PARCELLE = 'parcelle',
  SEGMENT = 'segment',
  INCONNUE = 'inconnue',
}

export class Point implements PointTurf {
  @Equals('Point')
  @ApiProperty({ required: true, nullable: false })
  type: 'Point';

  @Validate(PointValidator)
  @ApiProperty({ required: true, nullable: false, type: Number, isArray: true })
  coordinates: PositionTurf;
}

export class Position {
  @ValidateNested()
  @IsNotEmpty()
  @ApiProperty({ required: true, nullable: false, type: Point })
  point: Point;

  @ApiProperty({
    required: true,
    nullable: false,
    enum: PositionTypeEnum,
  })
  @IsNotEmpty()
  @IsEnum(PositionTypeEnum)
  type: PositionTypeEnum;
}
