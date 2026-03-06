import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SignalementStatusEnum } from './signalement.types';
import {
  CreateSignalementDTO,
  UpdateSignalementDTO,
} from './dto/signalement.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Signalement } from './signalement.entity';
import { Repository } from 'typeorm';
import { SourceService } from '../source/source.service';
import { ClientService } from '../client/client.service';
import {
  getSignalementLocationLabel,
  getSignalementLocationTypeLabel,
} from './signalement.utils';
import { SettingService } from '../setting/setting.service';
import {
  BaseReportService,
  CreateReportDTO,
  UpdateReportDTO,
} from '../../common/base-report.service';
import { StatsDTO } from '../stats/stats.dto';

@Injectable()
export class SignalementService extends BaseReportService<Signalement> {
  constructor(
    @InjectRepository(Signalement)
    signalementRepository: Repository<Signalement>,
    @Inject(forwardRef(() => SourceService))
    sourceService: SourceService,
    @Inject(forwardRef(() => ClientService))
    clientService: ClientService,
    mailerService: MailerService,
    settingService: SettingService,
  ) {
    super(
      signalementRepository,
      sourceService,
      clientService,
      mailerService,
      settingService,
    );
  }

  protected get entityName(): string {
    return 'Signalement';
  }

  protected get entityAlias(): string {
    return 'signalement';
  }

  protected createEntity(createDTO: CreateReportDTO): Signalement {
    return new Signalement(createDTO as CreateSignalementDTO);
  }

  protected getExtraUpdateFields(
    updateDTO: UpdateReportDTO,
  ): Partial<Record<string, any>> {
    const { rejectionReason } = updateDTO as UpdateSignalementDTO;
    return rejectionReason !== undefined ? { rejectionReason } : {};
  }

  protected buildEmailContext(
    entity: Omit<Signalement, 'author'>,
  ): Record<string, any> {
    // Cast needed because Omit removes knowledge of Signalement-specific fields,
    // but the entity still has them at runtime
    const signalement = entity as Signalement;
    return {
      date: new Date(entity.createdAt).toLocaleDateString('fr-FR'),
      location: `${getSignalementLocationLabel(signalement)} - ${entity.nomCommune}`,
      locationType: getSignalementLocationTypeLabel(signalement),
      commune: entity.nomCommune,
      rejectionReason: signalement.rejectionReason,
    };
  }

  async getStats(): Promise<StatsDTO> {
    const qb = this.repository.createQueryBuilder('signalement');

    const signalementCount = await qb.getCount();

    const signalementsBySources: Array<{
      count: number;
      source: string;
      status: SignalementStatusEnum;
    }> = await qb
      .select('source.nom', 'source')
      .addSelect('COUNT(signalement.id)', 'count')
      .addSelect('signalement.status', 'status')
      .groupBy('source.id')
      .addGroupBy('signalement.status')
      .leftJoin('signalement.source', 'source')
      .getRawMany();

    const signalementsProcessedByClients: Array<{
      count: number;
      client: string | null;
      status: SignalementStatusEnum;
    }> = await qb
      .select('client.nom', 'client')
      .addSelect('COUNT(signalement.id)', 'count')
      .addSelect('signalement.status', 'status')
      .groupBy('client.id')
      .addGroupBy('signalement.status')
      .leftJoin('signalement.processedBy', 'client')
      .getRawMany();

    return {
      total: signalementCount,
      fromSources: signalementsBySources.reduce(
        (acc, { source, count, status }) => {
          if (!acc[source]) {
            acc[source] = {};
          }
          acc[source][status] = count;

          return acc;
        },
        {},
      ),
      processedBy: signalementsProcessedByClients.reduce(
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

  async getPendingSignalementsReport(): Promise<
    { codeCommune: string; count: number }[]
  > {
    const qb = this.repository.createQueryBuilder('signalement');

    const report = await qb
      .select('code_commune', 'codeCommune')
      .addSelect('COUNT(signalement.id)', 'count')
      .where('signalement.status = :status', {
        status: SignalementStatusEnum.PENDING,
      })
      .groupBy('code_commune')
      .getRawMany();

    return report as { codeCommune: string; count: number }[];
  }
}
