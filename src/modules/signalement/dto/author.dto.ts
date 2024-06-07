import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class AuthorDTO {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: true, nullable: false })
  @IsEmail()
  email: string;

  @ApiProperty({ required: true, nullable: false })
  captchaToken: string;
}
