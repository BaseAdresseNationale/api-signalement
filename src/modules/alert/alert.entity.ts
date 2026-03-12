import { ChildEntity, Column, AfterLoad } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Report } from '../report/report.entity';
import { AlertTypeEnum } from './alert.types';
import { CreateAlertDTO } from './alert.dto';
import { MissingAddressContext } from './schemas/alert-context.schema';
import { ReportStatusEnum } from '../../common/report-status.enum';
import { ReportKindEnum } from '../report/report.type';

@ChildEntity('alert')
export class Alert extends Report {
  @ApiProperty({ required: true, nullable: false, enum: AlertTypeEnum })
  declare type: AlertTypeEnum;

  @Column('text', { name: 'comment', nullable: true })
  @ApiProperty({ required: true, nullable: false })
  comment: string;

  @Column('jsonb', { nullable: true })
  @ApiProperty({ required: false, nullable: true, type: MissingAddressContext })
  context?: MissingAddressContext;

  constructor(createInput: CreateAlertDTO) {
    super();
    if (createInput) {
      const { codeCommune, type, author, point, comment, context } =
        createInput;
      this.codeCommune = codeCommune;
      this.author = author;
      this.status = ReportStatusEnum.PENDING;
      this.type = type;
      this.point = point;
      this.comment = comment;
      this.context = context;
    }
  }

  @AfterLoad()
  setReportKind?(): void {
    this.reportKind = ReportKindEnum.ALERT;
  }
}
