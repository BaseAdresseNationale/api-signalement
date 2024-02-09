import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  Validate,
  ValidateNested,
} from 'class-validator';
import { ValidatorCogCommune } from 'src/validators/cog.validator';
import { ExistingLocationTypeEnum } from './schemas/existing-location.schema';
import { SignalementTypeEnum } from './schemas/signalement.schema';

class AuthorDTO {
  @ApiProperty({ required: false, nullable: true })
  firstName: string;

  @ApiProperty({ required: false, nullable: true })
  lastName: string;

  @ApiProperty({ required: true, nullable: false })
  @IsEmail()
  email: string;
}

class ExistingLocationDTO {
  @ApiProperty({ required: true, nullable: false })
  @IsEnum(ExistingLocationTypeEnum)
  type: ExistingLocationTypeEnum;

  @ApiProperty({ required: true, nullable: false })
  label: string;
}

class ChangesRequestedDTO {
  @ApiProperty({ required: true, nullable: false })
  changes: string;
}

export class CreateSignalementDTO {
  @ApiProperty({ required: true, nullable: false })
  @Validate(ValidatorCogCommune, ['commune'])
  codeCommune: string;

  @IsNotEmpty()
  @IsEnum(SignalementTypeEnum)
  @ApiProperty({ required: true, nullable: false })
  type: SignalementTypeEnum;

  @ApiProperty({ required: false, nullable: true })
  @IsObject()
  @ValidateNested()
  @Type(() => AuthorDTO)
  author: AuthorDTO;

  @ApiProperty({ required: false, nullable: true })
  @IsObject()
  @ValidateNested()
  @Type(() => ExistingLocationDTO)
  existingLocation: ExistingLocationDTO;

  @ApiProperty({ required: true, nullable: true })
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => ChangesRequestedDTO)
  changesRequested: ChangesRequestedDTO;
}
