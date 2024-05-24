import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { SchemaTypes, Types } from 'mongoose';

export class BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ type: SchemaTypes.Date, default: Date.now })
  @ApiProperty({ required: true, nullable: false })
  _createdAt: number;

  @Prop({ type: SchemaTypes.Date, default: Date.now })
  @ApiProperty({ required: true, nullable: false })
  _updatedAt: number;

  @Prop({ type: SchemaTypes.Date, default: null })
  @ApiProperty({ required: false, nullable: true })
  _deletedAt?: number;
}
