import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from './signalement.types';
import { Source } from '../source/source.entity';
import { Client } from '../client/client.entity';
import { CreateSignalementInput } from './dto/signalement.dto';
import {
  ExistingLocation,
  ExistingNumero,
  ExistingToponyme,
  ExistingVoie,
} from './schemas/existing-location.schema';
import { Author } from './schemas/author.schema';
import {
  DeleteNumeroChangesRequestedDTO,
  NumeroChangesRequestedDTO,
  ToponymeChangesRequestedDTO,
  VoieChangesRequestedDTO,
} from './dto/changes-requested.dto';

@Entity('signalements')
@ApiExtraModels(
  ExistingLocation,
  ExistingNumero,
  ExistingToponyme,
  ExistingVoie,
  NumeroChangesRequestedDTO,
  DeleteNumeroChangesRequestedDTO,
  ToponymeChangesRequestedDTO,
  VoieChangesRequestedDTO,
)
export class Signalement extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Column('text', { name: 'code_commune' })
  codeCommune: string;

  @Column('enum', { enum: SignalementTypeEnum, nullable: false })
  @ApiProperty({ required: true, nullable: false, enum: SignalementTypeEnum })
  type: SignalementTypeEnum;

  @Column('jsonb', { select: false, nullable: true })
  @ApiProperty({ required: false, nullable: true, type: Author })
  author?: Author;

  @Column('jsonb', { name: 'existing_location' })
  @ApiProperty({
    required: false,
    nullable: true,
    oneOf: [
      { $ref: getSchemaPath(ExistingNumero) },
      { $ref: getSchemaPath(ExistingVoie) },
      { $ref: getSchemaPath(ExistingToponyme) },
    ],
  })
  existingLocation?: ExistingNumero | ExistingVoie | ExistingToponyme;

  @Column('jsonb', { name: 'changes_requested' })
  @ApiProperty({
    required: true,
    nullable: false,
    oneOf: [
      { $ref: getSchemaPath(NumeroChangesRequestedDTO) },
      { $ref: getSchemaPath(DeleteNumeroChangesRequestedDTO) },
      { $ref: getSchemaPath(ToponymeChangesRequestedDTO) },
      { $ref: getSchemaPath(VoieChangesRequestedDTO) },
    ],
  })
  changesRequested:
    | NumeroChangesRequestedDTO
    | DeleteNumeroChangesRequestedDTO
    | ToponymeChangesRequestedDTO
    | VoieChangesRequestedDTO;

  @Column('enum', { enum: SignalementStatusEnum, nullable: false })
  @ApiProperty({ required: false, nullable: true, enum: SignalementStatusEnum })
  status: SignalementStatusEnum;

  @ManyToOne(() => Source, (source) => source.signalements, {
    eager: true,
    persistence: false,
  })
  @JoinColumn({ name: 'source_id', referencedColumnName: 'id' })
  @ApiProperty({ required: true, nullable: false, type: Source })
  source: Source;

  @ApiProperty({ required: false, nullable: true, type: Client })
  @JoinColumn({ name: 'processed_by', referencedColumnName: 'id' })
  @ManyToOne(() => Client, (client) => client.processedSignalements, {
    eager: true,
    persistence: false,
  })
  processedBy?: Client;

  constructor(createInput: CreateSignalementInput) {
    super();
    if (createInput) {
      const { codeCommune, type, changesRequested, author, existingLocation } =
        createInput;
      this.codeCommune = codeCommune;
      this.type = type;
      this.changesRequested = changesRequested;
      this.author = author;
      this.existingLocation = existingLocation;
      this.status = SignalementStatusEnum.PENDING;
      this.type = type;
    }
  }
}
