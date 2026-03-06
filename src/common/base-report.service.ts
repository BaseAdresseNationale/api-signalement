import { HttpException, HttpStatus } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { DeleteResult, Repository } from 'typeorm';
import { SourceService } from '../modules/source/source.service';
import { ClientService } from '../modules/client/client.service';
import { SettingService } from '../modules/setting/setting.service';
import { BaseEntity } from './base.entity';
import { getCols } from '../utils/repository.utils';
import { ReportStatusEnum } from './report-status.enum';
import { PaginatedResult } from './dto/paginated-result.dto';

export interface CreateReportDTO {
  codeCommune: string;
  author?: { firstName?: string; lastName?: string; email?: string };
}

export interface UpdateReportDTO {
  status: ReportStatusEnum;
}

export abstract class BaseReportService<
  T extends BaseEntity & {
    codeCommune: string;
    status: ReportStatusEnum;
    source: any;
    processedBy?: any;
    author?: { firstName?: string; lastName?: string; email?: string };
    nomCommune?: string;
  },
> {
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

  /** Construit le contexte additionnel pour l'email de notification */
  protected buildEmailContext(entity: Omit<T, 'author'>): Record<string, any> {
    return {
      date: new Date(entity.createdAt).toLocaleDateString('fr-FR'),
      commune: entity.nomCommune,
    };
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

    await this.repository.update(
      { id: entityId } as any,
      {
        status,
        processedBy: client,
        ...this.getExtraUpdateFields(updateDTO),
      } as any,
    );

    const { author, ...updatedEntity } = (await this.findOneOrFail(entityId, {
      withAuthor: true,
    })) as any;

    if (
      author?.email &&
      [ReportStatusEnum.PROCESSED, ReportStatusEnum.IGNORED].includes(
        updatedEntity.status,
      )
    ) {
      try {
        await this.mailerService.sendMail({
          to: author.email,
          subject:
            updatedEntity.status === ReportStatusEnum.PROCESSED
              ? 'Votre signalement a bien été pris en compte'
              : "Votre signalement n'a pas été pris en compte",
          template:
            updatedEntity.status === ReportStatusEnum.PROCESSED
              ? 'processed'
              : 'ignored',
          context: this.buildEmailContext(updatedEntity),
        });
      } catch (error) {
        console.error(
          `An error occured while sending email to ${author.email}: ${error.message}`,
        );
      }
    }

    return updatedEntity as T;
  }

  deleteOne(id: string): Promise<DeleteResult> {
    return this.repository.delete({ id } as any);
  }
}
