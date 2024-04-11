import { Prop } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';
import { Position } from './position.schema';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class ChangesRequested {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.Number })
  numero: number;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  suffixe?: string;

  @ApiProperty({ required: false, nullable: true, type: [Position] })
  @Prop({ type: Array<Position> })
  @IsArray()
  positions?: Position[];

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: Array<string> })
  @IsArray()
  parcelles?: string[];

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  nomVoie?: string;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  nom?: string;
}
