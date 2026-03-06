import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceService } from '../source/source.service';
import { ClientService } from '../client/client.service';
import { SettingService } from '../setting/setting.service';
import { Alert } from './alert.entity';
import {
  BaseReportService,
  CreateReportDTO,
} from '../../common/base-report.service';
import { CreateAlertDTO } from './alert.dto';

@Injectable()
export class AlertService extends BaseReportService<Alert> {
  constructor(
    @InjectRepository(Alert)
    alertRepository: Repository<Alert>,
    @Inject(forwardRef(() => SourceService))
    sourceService: SourceService,
    @Inject(forwardRef(() => ClientService))
    clientService: ClientService,
    mailerService: MailerService,
    settingService: SettingService,
  ) {
    super(
      alertRepository,
      sourceService,
      clientService,
      mailerService,
      settingService,
    );
  }

  protected get entityName(): string {
    return 'Alert';
  }

  protected get entityAlias(): string {
    return 'alert';
  }

  protected createEntity(createDTO: CreateReportDTO): Alert {
    return new Alert(createDTO as CreateAlertDTO);
  }

  protected buildEmailContext(
    entity: Omit<Alert, 'author'>,
  ): Record<string, any> {
    return {
      date: new Date(entity.createdAt).toLocaleDateString('fr-FR'),
      commune: entity.nomCommune,
    };
  }
}
