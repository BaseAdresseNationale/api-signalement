import { Prop, Schema } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';
import { BaseEntity } from '../../common/base.schema';
import { ApiProperty } from '@nestjs/swagger';
import { generateToken } from '../../utils/token.utils';
import { createSchema } from '../../utils/mongoose.utils';

@Schema({ collection: 'clients' })
export class Client extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  nom: string;

  @Prop({
    type: SchemaTypes.String,
    default: generateToken,
  })
  token: string;
}

export const ClientSchema = createSchema(Client);
