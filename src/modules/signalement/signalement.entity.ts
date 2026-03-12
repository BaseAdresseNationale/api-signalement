import { ChildEntity, Column, AfterLoad } from 'typeorm';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { SignalementTypeEnum } from './signalement.types';
import { CreateSignalementInput } from './dto/signalement.dto';
import {
  ExistingLocation,
  ExistingNumero,
  ExistingToponyme,
  ExistingVoie,
} from './schemas/existing-location.schema';
import {
  DeleteNumeroChangesRequestedDTO,
  NumeroChangesRequestedDTO,
  ToponymeChangesRequestedDTO,
  VoieChangesRequestedDTO,
} from './dto/changes-requested.dto';
import { getSignalementPosition } from './signalement.utils';
import { Report } from '../report/report.entity';
import { ReportStatusEnum } from '../../common/report-status.enum';
import { ReportKindEnum } from '../report/report.type';

@ChildEntity('signalement')
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
export class Signalement extends Report {
  @ApiProperty({ required: true, nullable: false, enum: SignalementTypeEnum })
  declare type: SignalementTypeEnum;

  @Column('jsonb', { name: 'existing_location', nullable: true })
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

  @Column('jsonb', { name: 'changes_requested', nullable: true })
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

  @ApiProperty({ required: false })
  @Column('text', { name: 'rejection_reason', nullable: true })
  rejectionReason?: string;

  constructor(createInput: CreateSignalementInput) {
    super();
    if (createInput) {
      const { codeCommune, type, changesRequested, author, existingLocation } =
        createInput;
      this.codeCommune = codeCommune;
      this.changesRequested = changesRequested;
      this.author = author;
      this.existingLocation = existingLocation;
      this.status = ReportStatusEnum.PENDING;
      this.type = type;
      this.point = getSignalementPosition(this);
    }
  }

  @AfterLoad()
  setReportKind?(): void {
    this.reportKind = ReportKindEnum.SIGNALEMENT;
  }
}
