import { HttpException, HttpStatus } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { DeleteResult, Repository } from 'typeorm';
import { SourceService } from '../modules/source/source.service';
import { ClientService } from '../modules/client/client.service';
import { SettingService } from '../modules/setting/setting.service';
import { Report } from '../modules/report/report.entity';
import { getCols } from '../utils/repository.utils';
import { ReportStatusEnum } from './report-status.enum';
import { PaginatedResult } from './dto/paginated-result.dto';
import { MonthlyReportCountsDTO, StatsDTO } from '../modules/stats/stats.dto';

export interface CreateReportDTO {
  codeCommune: string;
  author?: { firstName?: string; lastName?: string; email?: string };
}

export interface UpdateReportDTO {
  status: ReportStatusEnum;
  rejectionReason?: string;
}

export abstract class BaseReportService<T extends Report> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly sourceService: SourceService,
    protected readonly clientService: ClientService,
    protected readonly mailerService: MailerService,
    protected readonly settingService: SettingService,
  ) {}

  /** Nom de l'entité pour les messages d'erreur et les query builders */
  protected abstract get entityName(): string;

  /** Alias utilisé dans le query builder (ex: 'alert', 'signalement') */
  protected abstract get entityAlias(): string;

  /** Crée une instance de l'entité à partir du DTO */
  protected abstract createEntity(createDTO: CreateReportDTO): T;

  /** Retourne les champs supplémentaires à passer au `repository.update()` */
  protected getExtraUpdateFields(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _updateDTO: UpdateReportDTO,
  ): Partial<Record<string, any>> {
    return {};
  }

  /** Retourne le sujet de l'email de notification */
  protected getEmailSubject(status: ReportStatusEnum): string {
    return status === ReportStatusEnum.PROCESSED
      ? 'Votre signalement a bien été pris en compte'
      : "Votre signalement n'a pas été pris en compte";
  }

  /** Retourne le nom du template email */
  protected getEmailTemplate(status: ReportStatusEnum): string {
    return status === ReportStatusEnum.PROCESSED ? 'processed' : 'ignored';
  }

  /** Construit le contexte additionnel pour l'email de notification */
  protected buildEmailContext(entity: Omit<T, 'author'>): Record<string, any> {
    return {
      date: new Date(entity.createdAt).toLocaleDateString('fr-FR'),
      commune: entity.nomCommune,
      rejectionReason: entity.rejectionReason,
    };
  }

  async getStats(): Promise<StatsDTO> {
    const total = await this.repository
      .createQueryBuilder(this.entityAlias)
      .getCount();

    const [fromSources, processedBy, byMonth] = await Promise.all([
      this.getStatsGroupedByRelation('sources', 'source_id'),
      this.getStatsGroupedByRelation('clients', 'processed_by'),
      this.getMonthlyStats(),
    ]);

    return { total, fromSources, processedBy, byMonth };
  }

  // Agrège mois par mois (date 'YYYY-MM') le nombre de reports créés
  // (created_at) et traités (updated_at des reports au statut PROCESSED, mis à
  // jour une seule fois lors du traitement). Renvoie une ligne par (mois, type)
  // pour être directement exploitable par les graphiques ant-design, en
  // comblant les mois sans donnée entre le plus ancien et le plus récent
  // (count à 0).
  private async getMonthlyStats(): Promise<MonthlyReportCountsDTO[]> {
    const { tableName, discriminatorColumn, discriminatorValue } =
      this.repository.metadata;

    const [{ result }] = await this.repository.manager.query<
      [{ result: MonthlyReportCountsDTO[] }]
    >(
      `
        WITH events AS (
          SELECT date_trunc('month', report.created_at) AS month,
                 'created'::text AS type
          FROM ${tableName} report
          WHERE report.${discriminatorColumn.databaseName} = $1
          UNION ALL
          SELECT date_trunc('month', report.updated_at) AS month,
                 'processed'::text AS type
          FROM ${tableName} report
          WHERE report.${discriminatorColumn.databaseName} = $1
            AND report.status = $2
        ),
        counts AS (
          SELECT month, type, COUNT(*) AS count
          FROM events
          GROUP BY month, type
        ),
        bounds AS (
          SELECT MIN(month) AS min_month, MAX(month) AS max_month FROM events
        ),
        grid AS (
          SELECT gs.month, t.type
          FROM bounds,
               generate_series(
                 bounds.min_month,
                 bounds.max_month,
                 interval '1 month'
               ) AS gs(month)
          CROSS JOIN (VALUES ('created'), ('processed')) AS t(type)
          WHERE bounds.min_month IS NOT NULL
        )
        SELECT COALESCE(
                 jsonb_agg(
                   jsonb_build_object(
                     'date', to_char(grid.month, 'YYYY-MM'),
                     'type', grid.type,
                     'count', COALESCE(counts.count, 0)
                   )
                   ORDER BY grid.month, grid.type
                 ),
                 '[]'::jsonb
               ) AS result
        FROM grid
        LEFT JOIN counts
          ON counts.month = grid.month
          AND counts.type = grid.type
      `,
      [discriminatorValue, ReportStatusEnum.PROCESSED],
    );

    return result ?? [];
  }

  // Agrège directement en base la structure { [nom]: { [status]: count } }
  // via jsonb_object_agg, ce qui évite tout post-traitement en JS.
  private async getStatsGroupedByRelation(
    relationTable: 'sources' | 'clients',
    foreignKey: 'source_id' | 'processed_by',
  ): Promise<Record<string, Record<ReportStatusEnum, number>>> {
    const { tableName, discriminatorColumn, discriminatorValue } =
      this.repository.metadata;

    const [{ result }] = await this.repository.manager.query<
      [{ result: Record<string, Record<ReportStatusEnum, number>> | null }]
    >(
      `
        SELECT jsonb_object_agg(name, statuses) AS result
        FROM (
          SELECT relation.nom AS name,
                 jsonb_object_agg(counts.status, counts.count) AS statuses
          FROM (
            SELECT report.${foreignKey} AS relation_id,
                   report.status AS status,
                   COUNT(report.id) AS count
            FROM ${tableName} report
            WHERE report.${discriminatorColumn.databaseName} = $1
            GROUP BY report.${foreignKey}, report.status
          ) counts
          JOIN ${relationTable} relation ON relation.id = counts.relation_id
          GROUP BY relation.nom
        ) grouped
      `,
      [discriminatorValue],
    );

    return result ?? {};
  }

  async findOneOrFail(
    id: string,
    options?: { withAuthor?: boolean },
  ): Promise<T> {
    const { withAuthor = false } = options || {};
    const entity = await this.repository.findOne({
      where: { id } as any,
      relations: ['source', 'processedBy'],
      ...(withAuthor && {
        select: getCols(this.repository),
      }),
    });

    if (!entity) {
      throw new HttpException(
        `${this.entityName} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return entity;
  }

  async findMany(
    filters: Record<string, any>,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResult<T>> {
    const [data, total] = await this.repository.findAndCount({
      where: {
        ...filters,
        ...(filters.source && { source: { id: filters.source } }),
      } as any,
      relations: ['source', 'processedBy'],
      order: { createdAt: 'DESC' } as any,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async findManyWhereInBBox(
    bbox: number[],
    filters: { status?: ReportStatusEnum },
  ): Promise<T[]> {
    const alias = this.entityAlias;
    const qb = this.repository
      .createQueryBuilder(alias)
      .leftJoinAndSelect(`${alias}.source`, 'source')
      .where(
        `${alias}.point @ ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)`,
        {
          xmin: bbox[0],
          ymin: bbox[1],
          xmax: bbox[2],
          ymax: bbox[3],
        },
      );

    if (filters.status) {
      qb.andWhere(`${alias}.status = :status`, { status: filters.status });
    }

    return qb.getMany();
  }

  async createOne(sourceId: string, createDTO: CreateReportDTO): Promise<T> {
    if (createDTO.author && Object.values(createDTO.author).every((v) => !v)) {
      delete createDTO.author;
    }

    const codeCommune = createDTO.codeCommune;
    const communeStatus = await this.settingService.getCommuneStatus(
      codeCommune,
      sourceId,
    );

    if (communeStatus.disabled) {
      throw new HttpException(
        `${this.entityName} disabled for commune ${codeCommune}`,
        HttpStatus.METHOD_NOT_ALLOWED,
      );
    }

    const newEntity = this.createEntity(createDTO);
    const source = await this.sourceService.findOneOrFail(sourceId);
    (newEntity as any).source = source;

    await this.repository.save(newEntity as any);

    return this.findOneOrFail(newEntity.id);
  }

  async updateOne(
    clientId: string,
    entityId: string,
    updateDTO: UpdateReportDTO,
  ): Promise<T> {
    const { status } = updateDTO;
    const client = await this.clientService.findOneOrFail(clientId);

    const entity = await this.findOneOrFail(entityId);

    if (entity.status !== ReportStatusEnum.PENDING) {
      throw new HttpException(
        `${this.entityName} already processed, cannot be updated`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const { rejectionReason } = updateDTO;
    await this.repository.update(
      { id: entityId } as any,
      {
        status,
        processedBy: client,
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
        ...this.getExtraUpdateFields(updateDTO),
      } as any,
    );

    const { author, ...updatedEntity } = (await this.findOneOrFail(entityId, {
      withAuthor: true,
    })) as any;

    const source = await this.sourceService.findOneOrFail(entity.source.id, {
      withAuthor: true,
    });
    const defaultAuthor = source.defaultAuthor;
    const authorEmail = author?.email || defaultAuthor?.email;

    if (
      authorEmail &&
      [ReportStatusEnum.PROCESSED, ReportStatusEnum.IGNORED].includes(
        updatedEntity.status,
      )
    ) {
      try {
        await this.mailerService.sendMail({
          to: authorEmail,
          subject: this.getEmailSubject(updatedEntity.status),
          template: this.getEmailTemplate(updatedEntity.status),
          context: this.buildEmailContext(updatedEntity),
        });
      } catch (error) {
        console.error(
          `An error occured while sending email to ${authorEmail}: ${error.message}`,
        );
      }
    }

    return updatedEntity as T;
  }

  deleteOne(id: string): Promise<DeleteResult> {
    return this.repository.delete({ id } as any);
  }
}
