import { Entity, Column, OneToMany } from 'typeorm';
import { CreateSourceDTO } from './source.dto';
import { BaseEntity } from '../../common/base.entity';
import { generateToken } from '../../utils/token.utils';
import { ApiProperty } from '@nestjs/swagger';
import { SourceTypeEnum } from './source.types';
import { Report } from '../report/report.entity';

@Entity('sources')
export class Source extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Column()
  nom: string;

  @ApiProperty({ required: true, nullable: false, enum: SourceTypeEnum })
  @Column('enum', { enum: SourceTypeEnum, nullable: false })
  type: SourceTypeEnum;

  @Column({ nullable: true, select: false })
  token?: string;

  @OneToMany(() => Report, (report) => report.source, {
    persistence: false,
  })
  @ApiProperty({
    required: false,
    nullable: true,
    default: [],
    type: () => [Report],
  })
  reports?: Report[];

  constructor(createInput: CreateSourceDTO) {
    super();
    if (createInput) {
      const { nom, type } = createInput;
      this.nom = nom;
      this.type = type;
      if (type === SourceTypeEnum.PRIVATE) {
        this.token = generateToken();
      }
    }
  }
}
