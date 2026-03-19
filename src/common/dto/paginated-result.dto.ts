import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../base.entity';

export class PaginatedResult<T extends BaseEntity> {
  @ApiProperty({ required: true, nullable: false })
  data: T[];

  @ApiProperty({ required: true, nullable: false, type: Number })
  page: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  limit: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  total: number;
}
