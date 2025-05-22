import { ApiProperty } from '@nestjs/swagger';

export class EnabledListDTO {
  @ApiProperty({ required: true, nullable: false })
  id: string;
}
