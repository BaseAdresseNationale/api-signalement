import { ApiProperty } from '@nestjs/swagger';

export class Author {
  @ApiProperty({ required: false, nullable: true })
  email?: string;
}
