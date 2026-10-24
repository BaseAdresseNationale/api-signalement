import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ClientPublicationType } from './client.types';

export class CreateClientDTO {
  @ApiProperty({ required: true, nullable: false })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  partenaireId?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: ClientPublicationType,
  })
  @IsOptional()
  @IsEnum(ClientPublicationType)
  publicationType?: ClientPublicationType;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  publicationId?: string;
}
