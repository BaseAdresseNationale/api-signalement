import { Prop } from '@nestjs/mongoose';
import { SchemaTypes, Types } from 'mongoose';

export class BaseEntity {
  @Prop({ type: SchemaTypes.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ type: SchemaTypes.Date, default: Date.now })
  _created: Date;

  @Prop({ type: SchemaTypes.Date, default: Date.now })
  _updated: Date;

  @Prop({ type: SchemaTypes.Date, default: null })
  _deleted?: Date;
}
