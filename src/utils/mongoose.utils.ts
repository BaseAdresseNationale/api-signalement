import { Schema } from 'mongoose';
import { SchemaFactory } from '@nestjs/mongoose';

export function createSchema(schemaDef): Schema {
  const schema = SchemaFactory.createForClass(schemaDef);
  schema.pre('save', function (next) {
    this._updatedAt = Date.now();
    next();
  });

  return schema;
}
