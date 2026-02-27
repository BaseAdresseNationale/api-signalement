import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Point,
  AfterLoad,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Source } from '../source/source.entity';
import { Client } from '../client/client.entity';
import { getCommune } from '../../utils/cog.utils';
import { AlertStatusEnum, AlertTypeEnum } from './alert.types';
import { CreateAlertDTO } from './alert.dto';
import { Author } from '../../common/schema/author.schema';

@Entity('alerts')
export class Alert extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Column('text', { name: 'code_commune' })
  codeCommune: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  nomCommune?: string;

  @Column('enum', { enum: AlertTypeEnum, nullable: false })
  @ApiProperty({ required: true, nullable: false, enum: AlertTypeEnum })
  type: AlertTypeEnum;

  @Index('IDX_alerts_point', { spatial: true })
  @ApiProperty()
  @Column('geometry', {
    nullable: false,
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  point: Point;

  @Column('jsonb', { select: false, nullable: true })
  @ApiProperty({ required: false, nullable: true, type: Author })
  author?: Author;

  @Column('enum', { enum: AlertStatusEnum, nullable: false })
  @ApiProperty({ required: true, nullable: false, enum: AlertStatusEnum })
  status: AlertStatusEnum;

  @ManyToOne(() => Source, (source) => source.alerts, {
    eager: true,
    persistence: false,
  })
  @JoinColumn({ name: 'source_id', referencedColumnName: 'id' })
  @ApiProperty({ required: true, nullable: false, type: () => Source })
  source: Source;

  @Column('text', { name: 'content' })
  content: string;

  @ApiProperty({ required: false, nullable: true, type: () => Client })
  @JoinColumn({ name: 'processed_by', referencedColumnName: 'id' })
  @ManyToOne(() => Client, (client) => client.processedAlerts, {
    eager: true,
    persistence: false,
  })
  processedBy?: Client;

  constructor(createInput: CreateAlertDTO) {
    super();
    if (createInput) {
      const { codeCommune, type, author, point, content } = createInput;
      this.codeCommune = codeCommune;
      this.author = author;
      this.status = AlertStatusEnum.PENDING;
      this.type = type;
      this.point = point;
      this.content = content;
    }
  }

  @AfterLoad()
  getNomCommune?(): void {
    this.nomCommune = getCommune(this.codeCommune)?.nom;
  }
}
