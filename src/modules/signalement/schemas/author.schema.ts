import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SchemaTypes } from 'mongoose';

export class Author {
  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.String })
  email?: string;
}
