import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ExistingNumero } from '../../signalement/schemas/existing-location.schema';

export class MissingAddressContext {
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  idRNB?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    type: ExistingNumero,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExistingNumero)
  createdAddress?: ExistingNumero;
}
