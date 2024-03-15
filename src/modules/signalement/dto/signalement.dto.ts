import { ApiProperty } from '@nestjs/swagger';
import { Type, TypeHelpOptions } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  Validate,
  ValidateNested,
} from 'class-validator';
import { ValidatorCogCommune } from 'src/validators/cog.validator';
import { ExistingLocation } from '../schemas/existing-location.schema';
import { SignalementTypeEnum } from '../schemas/signalement.schema';
import { AuthorDTO } from './author.dto';
import {
  DeleteNumeroChangesRequestedDTO,
  NumeroChangesRequestedDTO,
} from './changes-requested.dto';

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
  @IsObject()
  @ValidateNested()
  @Type(() => AuthorDTO)
  author: AuthorDTO;

  @ApiProperty({ required: false, nullable: true, type: ExistingLocation })
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
        return NumeroChangesRequestedDTO;
      case SignalementTypeEnum.LOCATION_TO_DELETE:
        return DeleteNumeroChangesRequestedDTO;
      case SignalementTypeEnum.LOCATION_TO_CREATE:
        return NumeroChangesRequestedDTO;
      default:
        return NumeroChangesRequestedDTO;
    }
  })
  changesRequested: NumeroChangesRequestedDTO | DeleteNumeroChangesRequestedDTO;
}

export class UpdateSignalementDTO {
  @IsMongoId()
  @ApiProperty({ required: true, nullable: false })
  id: string;
}
