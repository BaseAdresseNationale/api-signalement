import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreatedAddress {
  @ApiProperty({ required: true, nullable: false, type: String })
  @IsString()
  idBAN: string;

  @ApiProperty({ required: true, nullable: false, type: String })
  @IsString()
  label: string;
}
export class MissingAddressContext {
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  idRNB?: string;

  @ApiProperty({ required: false, nullable: true, type: CreatedAddress })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatedAddress)
  createdAddress?: CreatedAddress;
}
