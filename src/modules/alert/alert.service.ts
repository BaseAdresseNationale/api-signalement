import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { SourceService } from '../source/source.service';
import { ClientService } from '../client/client.service';
import { SettingService } from '../setting/setting.service';
import { Alert } from './alert.entity';
import { getCols } from '../../utils/repository.utils';
import { AlertStatusEnum, AlertTypeEnum } from './alert.types';
import {
  CreateAlertDTO,
  PaginatedAlertsDTO,
  UpdateAlertDTO,
} from './alert.dto';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @Inject(forwardRef(() => SourceService))
    private readonly sourceService: SourceService,
    @Inject(forwardRef(() => ClientService))
    private readonly clientService: ClientService,
    private readonly mailerService: MailerService,
    private readonly settingService: SettingService,
  ) {}

  async findOneOrFail(
    id: string,
    options?: { withAuthor?: boolean },
  ): Promise<Alert> {
    const { withAuthor = false } = options || {};
    const alert = await this.alertRepository.findOne({
      where: { id },
      relations: ['source', 'processedBy'],
      ...(withAuthor && {
        select: getCols(this.alertRepository),
      }),
    });

    if (!alert) {
      throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
    }

    return alert;
  }

  async findMany(
    filters: {
      codeCommune?: string;
      source?: string;
      type?: AlertTypeEnum;
      status?: AlertStatusEnum;
    },
    pagination: {
      page: number;
      limit: number;
    },
  ): Promise<PaginatedAlertsDTO> {
    const [alerts, total] = await this.alertRepository.findAndCount({
      where: {
        ...filters,
        ...(filters.source && { source: { id: filters.source } }),
      },
      relations: ['source', 'processedBy'],
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      data: alerts,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async findManyWhereInBBox(
    bbox: number[],
    filters: { status?: AlertStatusEnum },
  ): Promise<Alert[]> {
    const qb = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.source', 'source')
      .where(
        'alert.point @ ST_MakeEnvelope(:xmin, :ymin, :xmax, :ymax, 4326)',
        {
          xmin: bbox[0],
          ymin: bbox[1],
          xmax: bbox[2],
          ymax: bbox[3],
        },
      );

    if (filters.status) {
      qb.andWhere('alert.status = :status', { status: filters.status });
    }

    return qb.getMany();
  }

  async createOne(
    sourceId: string,
    createAlertDTO: CreateAlertDTO,
  ): Promise<Alert> {
    if (
      createAlertDTO.author &&
      Object.values(createAlertDTO.author).every((v) => !v)
    ) {
      delete createAlertDTO.author;
    }

    const codeCommune = createAlertDTO.codeCommune;
    const communeStatus = await this.settingService.getCommuneStatus(
      codeCommune,
      sourceId,
    );

    if (communeStatus.disabled) {
      throw new HttpException(
        `Alert disabled for commune ${codeCommune}`,
        HttpStatus.METHOD_NOT_ALLOWED,
      );
    }

    const newAlert = new Alert(createAlertDTO);
    const source = await this.sourceService.findOneOrFail(sourceId);
    newAlert.source = source;

    await this.alertRepository.save(newAlert);

    return this.findOneOrFail(newAlert.id);
  }

  async updateOne(
    clientId: string,
    alertId: string,
    updateAlertDTO: UpdateAlertDTO,
  ): Promise<Alert> {
    const { status } = updateAlertDTO;
    const client = await this.clientService.findOneOrFail(clientId);

    const alert = await this.findOneOrFail(alertId);

    if (alert.status !== AlertStatusEnum.PENDING) {
      throw new HttpException(
        'Alert already processed, cannot be updated',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.alertRepository.update(
      { id: alertId },
      {
        status,
        processedBy: client,
      },
    );

    const { author, ...updatedAlert } = await this.findOneOrFail(alertId, {
      withAuthor: true,
    });

    if (
      author?.email &&
      [AlertStatusEnum.PROCESSED, AlertStatusEnum.IGNORED].includes(
        updatedAlert.status,
      )
    ) {
      try {
        await this.mailerService.sendMail({
          to: author.email,
          subject:
            updatedAlert.status === AlertStatusEnum.PROCESSED
              ? 'Votre signalement a bien été pris en compte'
              : "Votre signalement n'a pas été pris en compte",
          template:
            updatedAlert.status === AlertStatusEnum.PROCESSED
              ? 'processed'
              : 'ignored',
          context: {
            date: new Date(updatedAlert.createdAt).toLocaleDateString('fr-FR'),
            commune: updatedAlert.nomCommune,
          },
        });
      } catch (error) {
        console.error(
          `An error occured while sending email to ${author.email}: ${error.message}`,
        );
      }
    }

    return updatedAlert;
  }

  deleteOne(alertId: string): Promise<DeleteResult> {
    return this.alertRepository.delete({ id: alertId });
  }
}
