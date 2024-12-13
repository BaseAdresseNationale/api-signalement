import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, ValidateIf } from 'class-validator';

export class AuthorInput {
  @ApiProperty({ required: false, nullable: true })
  firstName?: string;

  @ApiProperty({ required: false, nullable: true })
  lastName?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsEmail()
  @ValidateIf(({ email }) => Boolean(email))
  email?: string;
}

export class AuthorDTO extends AuthorInput {
  @ApiProperty({ required: true, nullable: false })
  captchaToken: string;
}
