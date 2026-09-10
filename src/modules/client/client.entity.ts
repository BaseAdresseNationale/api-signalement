import { Entity, Column, OneToMany } from 'typeorm';
import { CreateClientDTO } from './client.dto';
import { BaseEntity } from '../../common/base.entity';
import { generateToken } from '../../utils/token.utils';
import { ApiProperty } from '@nestjs/swagger';
import { Report } from '../report/report.entity';
import { ClientPublicationType } from './client.types';

@Entity('clients')
export class Client extends BaseEntity {
  @Column()
  @ApiProperty({ required: true, nullable: false })
  nom: string;

  @Column({ select: false })
  token?: string;

  @Column('text', { name: 'partenaire_id', nullable: true })
  @ApiProperty({ required: false, nullable: true, type: String })
  partenaireId?: string;

  // Système via lequel ce partenaire publie ses adresses (API dépôt ou moissonneur)
  @Column('enum', {
    name: 'publication_type',
    enum: ClientPublicationType,
    nullable: true,
  })
  @ApiProperty({
    required: false,
    nullable: true,
    enum: ClientPublicationType,
  })
  publicationType?: ClientPublicationType;

  // Identifiant du partenaire dans le système de publication (id client API dépôt ou id source moissonneur)
  @Column('text', { name: 'publication_id', nullable: true })
  @ApiProperty({ required: false, nullable: true, type: String })
  publicationId?: string;

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
      const { nom, partenaireId, publicationType, publicationId } = createInput;
      this.nom = nom;
      this.partenaireId = partenaireId;
      this.publicationType = publicationType;
      this.publicationId = publicationId;
      this.token = generateToken();
    }
  }
}
