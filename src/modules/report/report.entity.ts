import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Point,
  AfterLoad,
  TableInheritance,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Source } from '../source/source.entity';
import { Client } from '../client/client.entity';
import { ReportStatusEnum } from '../../common/report-status.enum';
import { Author } from '../../common/schema/author.schema';
import { getCommune } from '../../utils/cog.utils';

@Entity('reports')
@TableInheritance({ column: { type: 'varchar', name: 'report_kind' } })
export class Report extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Column('text', { name: 'code_commune' })
  codeCommune: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  nomCommune?: string;

  @Column('text', { nullable: false })
  @ApiProperty({ required: true, nullable: false })
  type: string;

  @Column('jsonb', { select: false, nullable: true })
  @ApiProperty({ required: false, nullable: true, type: Author })
  author?: Author;

  @Column('text', { nullable: false, default: 'PENDING' })
  @ApiProperty({ required: true, nullable: false, enum: ReportStatusEnum })
  status: ReportStatusEnum;

  @Index('IDX_reports_point', { spatial: true })
  @ApiProperty()
  @Column('geometry', {
    nullable: true,
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  point?: Point;

  @ManyToOne(() => Source, (source) => source.reports, {
    eager: true,
    persistence: false,
  })
  @JoinColumn({ name: 'source_id', referencedColumnName: 'id' })
  @ApiProperty({ required: true, nullable: false, type: () => Source })
  source: Source;

  @ApiProperty({ required: false, nullable: true, type: () => Client })
  @JoinColumn({ name: 'processed_by', referencedColumnName: 'id' })
  @ManyToOne(() => Client, (client) => client.processedReports, {
    eager: true,
    persistence: false,
  })
  processedBy?: Client;

  @ApiProperty({ required: false, nullable: true })
  reportKind?: string;

  @AfterLoad()
  getNomCommune?(): void {
    this.nomCommune = getCommune(this.codeCommune)?.nom;
  }
}
