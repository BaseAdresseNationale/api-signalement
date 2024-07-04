import { Entity, Column, OneToMany } from 'typeorm';
import { CreateClientDTO } from './client.dto';
import { BaseEntity } from '../../common/base.entity';
import { generateToken } from '../../utils/token.utils';
import { SignalementEntity } from '../signalement/signalement.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('clients')
export class ClientEntity extends BaseEntity {
  @Column()
  @ApiProperty({ required: true, nullable: false })
  nom: string;

  @Column({ select: false })
  token?: string;

  @OneToMany(
    () => SignalementEntity,
    (signalement) => signalement.processedBy,
    {
      persistence: false,
    },
  )
  @ApiProperty({
    required: false,
    nullable: true,
    default: [],
    type: Array<SignalementEntity>,
  })
  processedSignalements?: SignalementEntity[];

  constructor(createInput: CreateClientDTO) {
    super();
    if (createInput) {
      const { nom } = createInput;
      this.nom = nom;
      this.token = generateToken();
    }
  }
}
