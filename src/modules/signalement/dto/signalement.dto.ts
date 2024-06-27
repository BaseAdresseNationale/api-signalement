import { ApiProperty } from '@nestjs/swagger';
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
  ExistingLocation,
  ExistingLocationTypeEnum,
} from '../schemas/existing-location.schema';

import { AuthorDTO } from './author.dto';
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
import { Signalement } from '../schemas/signalement.schema';

export class CreateSignalementDTO {
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

  @ApiProperty({ required: false, nullable: true, type: AuthorDTO })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthorDTO)
  author?: AuthorDTO;

  @ApiProperty({ required: false, nullable: true, type: ExistingLocation })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ExistingLocation)
  existingLocation?: ExistingLocation;

  @ApiProperty({ required: true, nullable: true })
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type((type: TypeHelpOptions) => {
    const payload: CreateSignalementDTO = type.object as CreateSignalementDTO;

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
        return NumeroChangesRequestedDTO;
      default:
        throw new Error('Invalid signalement type');
    }
  })
  changesRequested: NumeroChangesRequestedDTO | DeleteNumeroChangesRequestedDTO;
}

export class UpdateSignalementDTO {
  @ApiProperty({ required: true, nullable: false, enum: SignalementStatusEnum })
  @IsEnum(SignalementStatusEnum)
  status: SignalementStatusEnum;
}

export class PaginatedSignalementsDTO {
  @ApiProperty({ required: true, nullable: false, type: [Signalement] })
  @Type(() => Signalement)
  data: Signalement[];

  @ApiProperty({ required: true, nullable: false, type: Number })
  page: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  limit: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  total: number;
}
