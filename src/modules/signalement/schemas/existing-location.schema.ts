import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SchemaTypes } from 'mongoose';
import { Type } from 'class-transformer';
import { Position } from './position.schema';

export enum ExistingLocationTypeEnum {
  NUMERO = 'NUMERO',
  VOIE = 'VOIE',
  TOPONYME = 'TOPONYME',
}

export abstract class ExistingLocation {
  @ApiProperty({
    required: true,
    nullable: false,
    enum: ExistingLocationTypeEnum,
  })
  @Prop({ enum: ExistingLocationTypeEnum })
  type: ExistingLocationTypeEnum;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  banId?: string;
}

export class ExistingVoie extends ExistingLocation {
  constructor() {
    super();
    this.type = ExistingLocationTypeEnum.VOIE;
  }

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  nom: string;
}

export class ExistingToponyme extends ExistingLocation {
  constructor() {
    super();
    this.type = ExistingLocationTypeEnum.TOPONYME;
  }

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  nom: string;
}

export class ExistingNumero extends ExistingLocation {
  constructor() {
    super();
    this.type = ExistingLocationTypeEnum.NUMERO;
  }

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.Number })
  numero: number;

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  suffixe: string;

  @ApiProperty({ required: true, nullable: false, type: Position })
  @Type(() => Position)
  @Prop({ type: Position })
  position: Position;

  @ApiProperty({
    required: true,
    nullable: false,
    oneOf: [{ type: 'ExistingVoie' }, { type: 'ExistingToponyme' }],
  })
  @Prop({ type: ExistingLocation })
  toponyme: ExistingVoie | ExistingToponyme;
}
