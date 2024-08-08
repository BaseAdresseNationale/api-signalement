import { Position } from './position.schema';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class ChangesRequested {
  @ApiProperty({ required: false, nullable: true })
  numero?: number;

  @ApiProperty({ required: false, nullable: true })
  suffixe?: string;

  @ApiProperty({ required: false, nullable: true, type: [Position] })
  @IsArray()
  positions?: Position[];

  @ApiProperty({ required: false, nullable: true })
  @IsArray()
  parcelles?: string[];

  @ApiProperty({ required: false, nullable: true })
  nomVoie?: string;

  @ApiProperty({ required: false, nullable: true })
  nomComplement?: string;

  @ApiProperty({ required: false, nullable: true })
  nom?: string;

  @ApiProperty({ required: false, nullable: true })
  comment?: string;
}
