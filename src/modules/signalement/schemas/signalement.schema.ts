import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

import { BaseEntity } from './base.schema';
import { Author } from './author.schema';
import { ExistingLocation } from './existing-location.schema';
import { ApiProperty } from '@nestjs/swagger';
import { ChangesRequested } from './changes-requested.schema';

export enum SignalementTypeEnum {
  LOCATION_TO_UPDATE = 'LOCATION_TO_UPDATE',
  LOCATION_TO_DELETE = 'LOCATION_TO_DELETE',
  LOCATION_TO_CREATE = 'LOCATION_TO_CREATE',
  OTHER = 'OTHER',
}

export type BasesLocaleDocument = HydratedDocument<Signalement>;

@Schema({ collection: 'signalements' })
export class Signalement extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String })
  codeCommune: string;

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: SchemaTypes.String, enum: SignalementTypeEnum })
  type: SignalementTypeEnum;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: Author })
  author?: Author;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: ExistingLocation })
  existingLocation?: ExistingLocation;

  @ApiProperty({ required: true, nullable: false })
  @Prop({ type: ChangesRequested })
  changesRequested: ChangesRequested;

  @ApiProperty({ required: false, nullable: true })
  @Prop({ type: SchemaTypes.Date, default: null })
  processedAt?: Date;
}

export const SignalementSchema = SchemaFactory.createForClass(Signalement);
