import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SchemaTypes } from 'mongoose';

export enum ExistingLocationTypeEnum {
  NUMERO = 'NUMERO',
  VOIE = 'VOIE',
  TOPONYME = 'TOPONYME',
}

export abstract class ExistingLocation {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ enum: ExistingLocationTypeEnum })
  type: ExistingLocationTypeEnum;
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

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: ExistingLocation })
  toponyme: ExistingVoie | ExistingToponyme;
}
