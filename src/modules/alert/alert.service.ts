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
  UpdateReportDTO,
} from '../../common/base-report.service';
import { CreateAlertDTO, UpdateAlertDTO } from './alert.dto';
import { AlertStatusEnum } from './alert.types';
import { StatsDTO } from '../stats/stats.dto';

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

  protected getExtraUpdateFields(
    updateDTO: UpdateReportDTO,
  ): Partial<Record<string, any>> {
    const { rejectionReason, context } = updateDTO as UpdateAlertDTO;
    return {
      ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      ...(context !== undefined ? { context } : {}),
    };
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

  async getStats(): Promise<StatsDTO> {
    const qb = this.repository.createQueryBuilder('alert');

    const alertCount = await qb.getCount();

    const alertsBySources: Array<{
      count: number;
      source: string;
      status: AlertStatusEnum;
    }> = await qb
      .select('source.nom', 'source')
      .addSelect('COUNT(alert.id)', 'count')
      .addSelect('alert.status', 'status')
      .groupBy('source.id')
      .addGroupBy('alert.status')
      .leftJoin('alert.source', 'source')
      .getRawMany();

    const alertsProcessedByClients: Array<{
      count: number;
      client: string | null;
      status: AlertStatusEnum;
    }> = await qb
      .select('client.nom', 'client')
      .addSelect('COUNT(alert.id)', 'count')
      .addSelect('alert.status', 'status')
      .groupBy('client.id')
      .addGroupBy('alert.status')
      .leftJoin('alert.processedBy', 'client')
      .getRawMany();

    return {
      total: alertCount,
      fromSources: alertsBySources.reduce((acc, { source, count, status }) => {
        if (!acc[source]) {
          acc[source] = {};
        }
        acc[source][status] = count;

        return acc;
      }, {}),
      processedBy: alertsProcessedByClients.reduce(
        (acc, { client, count, status }) => {
          if (!client) {
            return acc;
          }
          if (!acc[client]) {
            acc[client] = {};
          }
          acc[client][status] = count;

          return acc;
        },
        {},
      ),
    };
  }
}
