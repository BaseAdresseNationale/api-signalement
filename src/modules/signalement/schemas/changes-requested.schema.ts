import { Prop } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';
import { Position } from './position.schema';
import { ApiProperty } from '@nestjs/swagger';

export class ChangesRequested {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.Number })
  numero: number;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  suffix?: string;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  position?: Position;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  voie?: string;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  toponyme?: string;
}
