import { Prop, Schema } from '@nestjs/mongoose';
import { SchemaTypes } from 'mongoose';

import { BaseEntity } from '../../../common/base.schema';
import { Author } from './author.schema';
import {
  ExistingLocation,
  ExistingNumero,
  ExistingToponyme,
  ExistingVoie,
} from './existing-location.schema';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ChangesRequested } from './changes-requested.schema';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from '../signalement.types';
import { createSchema } from '../../../utils/mongoose.utils';
import { Client } from '../../client/client.schema';
import { Source } from '../../source/source.schema';

@Schema({ collection: 'signalements' })
@ApiExtraModels(ExistingNumero, ExistingToponyme, ExistingVoie)
export class Signalement extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  codeCommune: string;

  @ApiProperty({ required: true, nullable: false, enum: SignalementTypeEnum })
  @Prop({ type: SchemaTypes.String, enum: SignalementTypeEnum })
  type: SignalementTypeEnum;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: Author })
  author?: Author;

  @ApiProperty({ required: true, nullable: false, type: Source })
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Source' })
  source: Source;

  @ApiProperty({
    required: false,
    nullable: true,
    oneOf: [
      { $ref: getSchemaPath(ExistingNumero) },
      { $ref: getSchemaPath(ExistingVoie) },
      { $ref: getSchemaPath(ExistingToponyme) },
    ],
  })
  @Prop({ type: ExistingLocation })
  existingLocation?: ExistingNumero | ExistingVoie | ExistingToponyme;

  @ApiProperty({ required: true, nullable: false, type: ChangesRequested })
  @Prop({ type: ChangesRequested })
  changesRequested: ChangesRequested;

  @ApiProperty({ required: false, nullable: true, enum: SignalementStatusEnum })
  @Prop({
    type: SchemaTypes.String,
    enum: SignalementStatusEnum,
    default: SignalementStatusEnum.PENDING,
  })
  status: SignalementStatusEnum;

  @ApiProperty({ required: false, nullable: true, type: Client })
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Client' })
  processedBy?: Client;
}

export const SignalementSchema = createSchema(Signalement);
