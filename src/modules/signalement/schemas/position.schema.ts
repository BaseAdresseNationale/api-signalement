import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsEnum,
  IsOptional,
  Validate,
  ValidateNested,
} from 'class-validator';
import { SchemaTypes } from 'mongoose';
import { Point as PointTurf, Position as PositionTurf } from '@turf/helpers';
import { PointValidator } from 'src/validators/point.validator';

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

class Point implements PointTurf {
  @Equals('Point')
  @ApiProperty({ required: true, nullable: false })
  @Prop({
    type: SchemaTypes.String,
    required: true,
    nullable: false,
  })
  type: 'Point';

  @Validate(PointValidator)
  @ApiProperty({ required: true, nullable: false, type: Number, isArray: true })
  @Prop({ type: [SchemaTypes.Number], required: true, nullable: false })
  coordinates: PositionTurf;
}

export class Position {
  @IsEnum(PositionTypeEnum)
  @ApiProperty({ enum: PositionTypeEnum })
  @Prop({ type: SchemaTypes.String, enum: PositionTypeEnum })
  type: PositionTypeEnum;

  @IsOptional()
  @ApiProperty()
  @Prop({ type: SchemaTypes.String })
  source?: string;

  @ValidateNested()
  @Type(() => Point)
  @ApiProperty({ type: () => Point })
  @Prop({ type: Point })
  point: Point;
}
