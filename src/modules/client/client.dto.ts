import { ApiProperty } from '@nestjs/swagger';

export class CreateClientDTO {
  @ApiProperty({ required: true, nullable: false })
  nom: string;
}
