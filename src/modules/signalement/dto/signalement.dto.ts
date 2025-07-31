import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Type, TypeHelpOptions } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  Validate,
  ValidateNested,
} from 'class-validator';
import { ValidatorCogCommune } from '../../../validators/cog.validator';
import {
  ExistingLocationTypeEnum,
  ExistingNumero,
  ExistingToponyme,
  ExistingVoie,
} from '../schemas/existing-location.schema';

import { AuthorDTO, AuthorInput } from './author.dto';
import {
  DeleteNumeroChangesRequestedDTO,
  NumeroChangesRequestedDTO,
  ToponymeChangesRequestedDTO,
  VoieChangesRequestedDTO,
} from './changes-requested.dto';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from '../signalement.types';
import { Signalement } from '../signalement.entity';
import { isToponymeChangesRequested } from '../signalement.utils';

export class CreateSignalementInput {
  @ApiProperty({ required: true, nullable: false, type: String })
  @Validate(ValidatorCogCommune, ['commune'])
  codeCommune: string;

  @IsNotEmpty()
  @IsEnum(SignalementTypeEnum)
  @ApiProperty({
    required: true,
    nullable: false,
    type: String,
    enum: SignalementTypeEnum,
  })
  type: SignalementTypeEnum;

  @ApiProperty({ required: false, nullable: true, type: AuthorInput })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthorInput)
  author?: AuthorInput;

  @ApiProperty({
    required: false,
    nullable: true,
    oneOf: [
      { $ref: getSchemaPath(ExistingNumero) },
      { $ref: getSchemaPath(ExistingVoie) },
      { $ref: getSchemaPath(ExistingToponyme) },
    ],
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type((type: TypeHelpOptions) => {
    const payload: CreateSignalementInput =
      type.object as CreateSignalementInput;

    if (
      !payload.existingLocation &&
      payload.type === SignalementTypeEnum.LOCATION_TO_CREATE
    ) {
      return;
    }

    switch (payload.existingLocation.type) {
      case ExistingLocationTypeEnum.NUMERO:
        return ExistingNumero;
      case ExistingLocationTypeEnum.TOPONYME:
        return ExistingToponyme;
      case ExistingLocationTypeEnum.VOIE:
        return ExistingVoie;
      default:
        throw new Error('Invalid existingLocation type');
    }
  })
  existingLocation?: ExistingNumero | ExistingVoie | ExistingToponyme;

  @ApiProperty({
    required: true,
    nullable: true,
    oneOf: [
      { $ref: getSchemaPath(NumeroChangesRequestedDTO) },
      { $ref: getSchemaPath(DeleteNumeroChangesRequestedDTO) },
      { $ref: getSchemaPath(ToponymeChangesRequestedDTO) },
      { $ref: getSchemaPath(VoieChangesRequestedDTO) },
    ],
  })
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type((type: TypeHelpOptions) => {
    const payload: CreateSignalementInput =
      type.object as CreateSignalementInput;

    switch (payload.type) {
      case SignalementTypeEnum.LOCATION_TO_UPDATE:
        switch (payload.existingLocation?.type) {
          case ExistingLocationTypeEnum.NUMERO:
            return NumeroChangesRequestedDTO;
          case ExistingLocationTypeEnum.TOPONYME:
            return ToponymeChangesRequestedDTO;
          case ExistingLocationTypeEnum.VOIE:
            return VoieChangesRequestedDTO;
          default:
            throw new Error('Invalid existingLocation type');
        }
      case SignalementTypeEnum.LOCATION_TO_DELETE:
        return DeleteNumeroChangesRequestedDTO;
      case SignalementTypeEnum.LOCATION_TO_CREATE:
        if (isToponymeChangesRequested(payload.changesRequested)) {
          return ToponymeChangesRequestedDTO;
        }
        return NumeroChangesRequestedDTO;
      default:
        throw new Error('Invalid signalement type');
    }
  })
  changesRequested:
    | NumeroChangesRequestedDTO
    | DeleteNumeroChangesRequestedDTO
    | ToponymeChangesRequestedDTO
    | VoieChangesRequestedDTO;
}

export class CreateSignalementDTO extends CreateSignalementInput {
  author?: AuthorDTO;
}

export class UpdateSignalementDTO {
  @ApiProperty({ required: true, nullable: false, enum: SignalementStatusEnum })
  @IsEnum(SignalementStatusEnum)
  status: SignalementStatusEnum;

  @ApiProperty({ required: false })
  rejectionReason?: string;
}

export class PaginatedSignalementsDTO {
  @ApiProperty({
    required: true,
    nullable: false,
    type: () => [Signalement],
  })
  data: Signalement[];

  @ApiProperty({ required: true, nullable: false, type: Number })
  page: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  limit: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  total: number;
}
