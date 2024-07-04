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
import { SignalementEntity } from './signalement.entity';
import { Repository } from 'typeorm';
import { SourceService } from '../source/source.service';
import { ClientService } from '../client/client.service';
import { getCols } from '../../utils/repository.utils';

@Injectable()
export class SignalementService {
  constructor(
    @InjectRepository(SignalementEntity)
    private readonly signalementRepository: Repository<SignalementEntity>,
    @Inject(forwardRef(() => SourceService))
    private readonly sourceService: SourceService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    private readonly mailerService: MailerService,
  ) {}

  async findOneOrFail(
    id: string,
    options?: { withAuthor?: boolean },
  ): Promise<SignalementEntity> {
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
      },
    );

    return {
      data: signalements,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async createOne(
    sourceId: string,
    createSignalementDTO: CreateSignalementDTO,
  ): Promise<SignalementEntity> {
    if (!createSignalementDTO.author?.email) {
      delete createSignalementDTO.author;
    }

    const newSignalement = new SignalementEntity(createSignalementDTO);
    const source = await this.sourceService.findOneOrFail(sourceId);
    newSignalement.source = source;

    await this.signalementRepository.save(newSignalement);

    return this.findOneOrFail(newSignalement.id);
  }

  async updateOne(
    clientId: string,
    signalementId: string,
    updateSignalementDTO: UpdateSignalementDTO,
  ): Promise<SignalementEntity> {
    const client = await this.clientService.findOneOrFail(clientId);

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

    if (author?.email) {
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
          signalement: updatedSignalement,
        },
      });
    }

    return updatedSignalement;
  }
}
