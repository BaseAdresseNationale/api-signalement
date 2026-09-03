import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClientDTO {
  @ApiProperty({ required: true, nullable: false })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  partenaireId?: string;
}
