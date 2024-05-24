import { Prop, Schema } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';
import { BaseEntity } from '../../common/base.schema';
import { ApiProperty } from '@nestjs/swagger';
import { generateToken } from '../../utils/token.utils';
import { createSchema } from '../../utils/mongoose.utils';
import { SourceTypeEnum } from './source.types';

@Schema({ collection: 'sources' })
export class Source extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  nom: string;

  @Prop({
    type: SchemaTypes.String,
    default: generateToken,
  })
  token: string;

  @ApiProperty({ required: true, nullable: false, enum: SourceTypeEnum })
  @Prop({ type: SchemaTypes.String })
  type: SourceTypeEnum;
}

export const SourceSchema = createSchema(Source);
