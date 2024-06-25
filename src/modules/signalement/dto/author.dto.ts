import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, ValidateIf } from 'class-validator';

export class AuthorDTO {
  @ApiProperty({ required: false, nullable: true })
  @IsEmail()
  @ValidateIf(({ email }) => Boolean(email))
  email?: string;

  @ApiProperty({ required: true, nullable: false })
  captchaToken: string;
}
