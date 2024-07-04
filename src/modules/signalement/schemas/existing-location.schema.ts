import { ApiProperty } from '@nestjs/swagger';
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
  type: ExistingLocationTypeEnum;

  @ApiProperty({ required: false, nullable: true })
  banId?: string;
}

export class ExistingVoie extends ExistingLocation {
  constructor() {
    super();
    this.type = ExistingLocationTypeEnum.VOIE;
  }

  @ApiProperty({ required: true, nullable: false })
  nom: string;
}

export class ExistingToponyme extends ExistingLocation {
  constructor() {
    super();
    this.type = ExistingLocationTypeEnum.TOPONYME;
  }

  @ApiProperty({ required: true, nullable: false })
  nom: string;
}

export class ExistingNumero extends ExistingLocation {
  constructor() {
    super();
    this.type = ExistingLocationTypeEnum.NUMERO;
  }

  @ApiProperty({ required: true, nullable: false })
  numero: number;

  @ApiProperty({ required: true, nullable: false })
  suffixe: string;

  @ApiProperty({ required: true, nullable: false, type: Position })
  @Type(() => Position)
  position: Position;

  @ApiProperty({
    required: true,
    nullable: false,
    oneOf: [{ type: 'ExistingVoie' }, { type: 'ExistingToponyme' }],
  })
  toponyme: ExistingVoie | ExistingToponyme;
}
