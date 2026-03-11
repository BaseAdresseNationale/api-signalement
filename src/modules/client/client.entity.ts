import { Entity, Column, OneToMany } from 'typeorm';
import { CreateClientDTO } from './client.dto';
import { BaseEntity } from '../../common/base.entity';
import { generateToken } from '../../utils/token.utils';
import { ApiProperty } from '@nestjs/swagger';
import { Report } from '../report/report.entity';

@Entity('clients')
export class Client extends BaseEntity {
  @Column()
  @ApiProperty({ required: true, nullable: false })
  nom: string;

  @Column({ select: false })
  token?: string;

  @OneToMany(() => Report, (report) => report.processedBy, {
    persistence: false,
  })
  @ApiProperty({
    required: false,
    nullable: true,
    default: [],
    type: () => [Report],
  })
  processedReports?: Report[];

  constructor(createInput: CreateClientDTO) {
    super();
    if (createInput) {
      const { nom } = createInput;
      this.nom = nom;
      this.token = generateToken();
    }
  }
}
