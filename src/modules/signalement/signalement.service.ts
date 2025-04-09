import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from './signalement.types';
import {
  CreateSignalementDTO,
  PaginatedSignalementsDTO,
  UpdateSignalementDTO,
} from './dto/signalement.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import { Signalement } from './signalement.entity';
import { Repository } from 'typeorm';
import { SourceService } from '../source/source.service';
import { ClientService } from '../client/client.service';
import { getCols } from '../../utils/repository.utils';
import { SignalementStatsDTO } from './dto/stats.dto';
import {
  getSignalementLocationLabel,
  getSignalementLocationTypeLabel,
} from './signalement.utils';
import { COGService } from '../cog/cog.service';

@Injectable()
export class SignalementService {
  constructor(
    @InjectRepository(Signalement)
    private readonly signalementRepository: Repository<Signalement>,
    @Inject(forwardRef(() => SourceService))
    private readonly sourceService: SourceService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    private readonly mailerService: MailerService,
    private readonly cogService: COGService,
  ) {}

  async findOneOrFail(
    id: string,
    options?: { withAuthor?: boolean },
  ): Promise<Signalement> {
    const { withAuthor = false } = options || {};
    const signalement = await this.signalementRepository.findOne({
      where: { id },
      relations: ['source', 'processedBy'],
      ...(withAuthor && {
        select: getCols(this.signalementRepository),
      }),
    });

    if (!signalement) {
      throw new HttpException('Signalement not found', HttpStatus.NOT_FOUND);
    }

    return signalement;
  }

  async findMany(
    filters: {
      codeCommune?: string;
      source?: string;
      type?: SignalementTypeEnum;
      status?: SignalementStatusEnum;
    },
    pagination: {
      page: number;
      limit: number;
    },
  ): Promise<PaginatedSignalementsDTO> {
    const [signalements, total] = await this.signalementRepository.findAndCount(
      {
        where: {
          ...filters,
          ...(filters.source && { source: { id: filters.source } }),
        },
        relations: ['source', 'processedBy'],
        order: { createdAt: 'DESC' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      },
    );

    return {
      data: signalements,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async findManyWhereInBBox(
    bbox: number[],
    filters: { status?: SignalementStatusEnum },
  ): Promise<Signalement[]> {
    const qb = this.signalementRepository
      .createQueryBuilder('signalement')
      .leftJoinAndSelect('signalement.source', 'source')
      .where(
        'signalement.point @ ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)',
        {
          xmin: bbox[0],
          ymin: bbox[1],
          xmax: bbox[2],
          ymax: bbox[3],
        },
      );

    if (filters.status) {
      qb.andWhere('signalement.status = :status', { status: filters.status });
    }

    return qb.getMany();
  }

  async createOne(
    sourceId: string,
    createSignalementDTO: CreateSignalementDTO,
  ): Promise<Signalement> {
    if (
      createSignalementDTO.author &&
      Object.values(createSignalementDTO.author).every((v) => !v)
    ) {
      delete createSignalementDTO.author;
    }

    const newSignalement = new Signalement(createSignalementDTO);
    const source = await this.sourceService.findOneOrFail(sourceId);
    newSignalement.source = source;

    await this.signalementRepository.save(newSignalement);

    return this.findOneOrFail(newSignalement.id);
  }

  async updateOne(
    clientId: string,
    signalementId: string,
    updateSignalementDTO: UpdateSignalementDTO,
  ): Promise<Signalement> {
    const client = await this.clientService.findOneOrFail(clientId);

    const signalement = await this.findOneOrFail(signalementId);

    if (signalement.status !== SignalementStatusEnum.PENDING) {
      throw new HttpException(
        'Signalement already processed, cannot be updated',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.signalementRepository.update(
      { id: signalementId },
      {
        status: updateSignalementDTO.status,
        processedBy: client,
      },
    );

    const { author, ...updatedSignalement } = await this.findOneOrFail(
      signalementId,
      { withAuthor: true },
    );

    if (
      author?.email &&
      [SignalementStatusEnum.PROCESSED, SignalementStatusEnum.IGNORED].includes(
        updatedSignalement.status,
      )
    ) {
      try {
        const commune = this.cogService.getCommuneByCode(
          updatedSignalement.codeCommune,
        );

        await this.mailerService.sendMail({
          to: author.email,
          subject:
            updatedSignalement.status === SignalementStatusEnum.PROCESSED
              ? 'Votre signalement a bien été pris en compte'
              : "Votre signalement n'a pas été pris en compte",
          template:
            updatedSignalement.status === SignalementStatusEnum.PROCESSED
              ? 'processed'
              : 'ignored',
          context: {
            date: new Date(updatedSignalement.createdAt).toLocaleDateString(
              'fr-FR',
            ),
            location: `${getSignalementLocationLabel(updatedSignalement)} - ${commune.nom}`,
            locationType: getSignalementLocationTypeLabel(updatedSignalement),
          },
        });
      } catch (error) {
        console.error(
          `An error occured while sending email to ${author.email}: ${error.message}`,
        );
      }
    }

    return updatedSignalement;
  }

  async getStats(): Promise<SignalementStatsDTO> {
    const qb = this.signalementRepository.createQueryBuilder('signalement');

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
    const qb = this.signalementRepository.createQueryBuilder('signalement');

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
