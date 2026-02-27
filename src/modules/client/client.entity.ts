import { Entity, Column, OneToMany } from 'typeorm';
import { CreateClientDTO } from './client.dto';
import { BaseEntity } from '../../common/base.entity';
import { generateToken } from '../../utils/token.utils';
import { Signalement } from '../signalement/signalement.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Alert } from '../alert/alert.entity';

@Entity('clients')
export class Client extends BaseEntity {
  @Column()
  @ApiProperty({ required: true, nullable: false })
  nom: string;

  @Column({ select: false })
  token?: string;

  @OneToMany(() => Signalement, (signalement) => signalement.processedBy, {
    persistence: false,
  })
  @ApiProperty({
    required: false,
    nullable: true,
    default: [],
    type: () => [Signalement],
  })
  processedSignalements?: Signalement[];

  @OneToMany(() => Alert, (alert) => alert.processedBy, {
    persistence: false,
  })
  @ApiProperty({
    required: false,
    nullable: true,
    default: [],
    type: () => [Alert],
  })
  processedAlerts?: Alert[];

  constructor(createInput: CreateClientDTO) {
    super();
    if (createInput) {
      const { nom } = createInput;
      this.nom = nom;
      this.token = generateToken();
    }
  }
}
