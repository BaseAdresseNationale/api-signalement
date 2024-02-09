import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SchemaTypes } from 'mongoose';

export enum ExistingLocationTypeEnum {
  NUMERO = 'NUMERO',
  VOIE = 'VOIE',
  TOPONYME = 'TOPONYME',
}

export class ExistingLocation {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ enum: ExistingLocationTypeEnum })
  type: ExistingLocationTypeEnum;

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  label: string;
}
