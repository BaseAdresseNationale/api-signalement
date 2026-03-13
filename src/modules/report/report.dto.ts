import { ApiProperty } from '@nestjs/swagger';
import { Report } from './report.entity';

export class PaginatedReportsDTO {
  @ApiProperty({
    required: true,
    nullable: false,
    type: () => [Report],
  })
  data: Report[];

  @ApiProperty({ required: true, nullable: false, type: Number })
  page: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  limit: number;

  @ApiProperty({ required: true, nullable: false, type: Number })
  total: number;
}
