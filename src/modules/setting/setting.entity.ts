import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('settings')
export class Setting extends BaseEntity {
  @ApiProperty({ required: true, nullable: false })
  @Column('text', { unique: true })
  name: string;

  @Column('jsonb')
  @ApiProperty({ required: true, nullable: false })
  content: any;
}
