import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SignalementStatusEnum } from './signalement.types';
import { CreateSignalementDTO } from './dto/signalement.dto';
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
} from '../../common/base-report.service';
import { StatsDTO } from '../stats/stats.dto';
import { ReportStatusEnum } from '../../common/report-status.enum';
import { getCommune } from '../../utils/cog.utils';

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

  protected buildEmailContext(
    entity: Omit<Signalement, 'author'>,
  ): Record<string, any> {
    // Cast needed because Omit removes knowledge of Signalement-specific fields,
    // but the entity still has them at runtime
    const signalement = entity as Signalement;
    return {
      ...super.buildEmailContext(entity),
      location: `${getSignalementLocationLabel(signalement)} - ${entity.nomCommune}`,
      locationType: getSignalementLocationTypeLabel(signalement),
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
          acc[source][status] = Number(count);

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
          acc[client][status] = Number(count);

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

    return report.map(({ codeCommune, count }) => ({
      codeCommune,
      count: Number(count),
    })) as { codeCommune: string; count: number }[];
  }

  async getSignalementCountsByCommune(): Promise<
    {
      codeCommune: string;
      nomCommune: string;
      pending: number;
      processed: number;
      ignored: number;
      expired: number;
      total: number;
    }[]
  > {
    const qb = this.repository.createQueryBuilder('signalement');

    const rawResults: {
      codeCommune: string;
      status: string;
      count: string;
    }[] = await qb
      .select('signalement.code_commune', 'codeCommune')
      .addSelect('signalement.status', 'status')
      .addSelect('COUNT(signalement.id)', 'count')
      .groupBy('signalement.code_commune')
      .addGroupBy('signalement.status')
      .getRawMany();

    const communeMap = new Map<
      string,
      {
        pending: number;
        processed: number;
        ignored: number;
        expired: number;
        total: number;
      }
    >();

    for (const row of rawResults) {
      if (!communeMap.has(row.codeCommune)) {
        communeMap.set(row.codeCommune, {
          pending: 0,
          processed: 0,
          ignored: 0,
          expired: 0,
          total: 0,
        });
      }
      const entry = communeMap.get(row.codeCommune);
      const count = Number(row.count);

      switch (row.status) {
        case ReportStatusEnum.PENDING:
          entry.pending = count;
          break;
        case ReportStatusEnum.PROCESSED:
          entry.processed = count;
          break;
        case ReportStatusEnum.IGNORED:
          entry.ignored = count;
          break;
        case ReportStatusEnum.EXPIRED:
          entry.expired = count;
          break;
      }
      entry.total += count;
    }

    return Array.from(communeMap.entries()).map(([codeCommune, counts]) => ({
      codeCommune,
      nomCommune: getCommune(codeCommune)?.nom || codeCommune,
      ...counts,
    }));
  }
}
