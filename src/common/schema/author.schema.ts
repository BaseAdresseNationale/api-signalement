import { ApiProperty } from '@nestjs/swagger';

export class Author {
  @ApiProperty({ required: false, nullable: true })
  firstName?: string;

  @ApiProperty({ required: false, nullable: true })
  lastName?: string;

  @ApiProperty({ required: false, nullable: true })
  email?: string;
}
