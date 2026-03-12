import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MissingAddressContext {
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  idRNB?: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  idBAN?: string;
}
