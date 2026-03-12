import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  Validate,
  ValidateNested,
} from 'class-validator';
import { ValidatorCogCommune } from '../../validators/cog.validator';
import { AlertStatusEnum, AlertTypeEnum } from './alert.types';
import { AuthorInput } from '../../common/dto/author.dto';
import { Alert } from './alert.entity';
import { PositionCoordinatesDTO } from '../../common/dto/position.dto';
import { PaginatedResult } from '../../common/dto/paginated-result.dto';
import { MissingAddressContext } from './schemas/alert-context.schema';

export class CreateAlertDTO {
  @ApiProperty({ required: true, nullable: false, type: String })
  @Validate(ValidatorCogCommune, ['commune'])
  codeCommune: string;

  @IsNotEmpty()
  @IsEnum(AlertTypeEnum)
  @ApiProperty({
    required: true,
    nullable: false,
    type: String,
    enum: AlertTypeEnum,
  })
  type: AlertTypeEnum;

  @ApiProperty({
    required: true,
    nullable: false,
    type: PositionCoordinatesDTO,
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PositionCoordinatesDTO)
  point: PositionCoordinatesDTO;

  @ApiProperty({ required: true, nullable: false, type: String })
  comment: string;

  @ApiProperty({ required: false, nullable: true, type: AuthorInput })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthorInput)
  author?: AuthorInput;

  @ApiProperty({ required: false, nullable: true, type: MissingAddressContext })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MissingAddressContext)
  context?: MissingAddressContext;
}

export class PaginatedAlertsDTO extends PaginatedResult<Alert> {
  @ApiProperty({
    required: true,
    nullable: false,
    type: () => [Alert],
  })
  declare data: Alert[];
}

export class UpdateAlertDTO {
  @ApiProperty({ required: true, nullable: false, enum: AlertStatusEnum })
  @IsEnum(AlertStatusEnum)
  status: AlertStatusEnum;

  @ApiProperty({ required: false, nullable: true, type: MissingAddressContext })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MissingAddressContext)
  context?: MissingAddressContext;

  @ApiProperty({ required: false })
  rejectionReason?: string;
}
