import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from './signalement.types';
import { SourceEntity } from '../source/source.entity';
import { ClientEntity } from '../client/client.entity';
import { CreateSignalementInput } from './dto/signalement.dto';
import {
  ExistingNumero,
  ExistingToponyme,
  ExistingVoie,
} from './schemas/existing-location.schema';
import { Author } from './schemas/author.schema';
import { ChangesRequested } from './schemas/changes-requested.schema';

@Entity('signalements')
export class SignalementEntity extends BaseEntity {
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
  @ApiProperty({ required: true, nullable: false, type: ChangesRequested })
  changesRequested: ChangesRequested;

  @Column('enum', { enum: SignalementStatusEnum, nullable: false })
  @ApiProperty({ required: false, nullable: true, enum: SignalementStatusEnum })
  status: SignalementStatusEnum;

  @ManyToOne(() => SourceEntity, (source) => source.signalements, {
    eager: true,
    persistence: false,
  })
  @JoinColumn({ name: 'source_id', referencedColumnName: 'id' })
  @ApiProperty({ required: true, nullable: false, type: SourceEntity })
  source: SourceEntity;

  @ApiProperty({ required: false, nullable: true, type: ClientEntity })
  @JoinColumn({ name: 'processed_by', referencedColumnName: 'id' })
  @ManyToOne(() => ClientEntity, (client) => client.processedSignalements, {
    eager: true,
    persistence: false,
  })
  processedBy?: ClientEntity;

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
