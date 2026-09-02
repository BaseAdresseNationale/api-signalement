import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateClientDTO {
  @ApiProperty({ required: true, nullable: false })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ required: true, nullable: false })
  @IsString()
  @IsNotEmpty()
  partenaireId: string;
}
