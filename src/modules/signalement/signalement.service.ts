import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from './signalement.types';
import {
  CreateSignalementDTO,
  PaginatedSignalementsDTO,
  UpdateSignalementDTO,
} from './dto/signalement.dto';
import { Signalement } from './schemas/signalement.schema';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class SignalementService {
  constructor(
    @InjectModel(Signalement.name) private signalementModel: Model<Signalement>,
    private readonly mailerService: MailerService,
  ) {}

  async findOneOrFail(id: string): Promise<Signalement> {
    const signalement = await this.signalementModel
      .findById(id, {
        author: 0,
      })
      .populate('source', { _id: 1, nom: 1, type: 1 })
      .populate('processedBy', { _id: 1, nom: 1 })
      .lean();
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
    const total = await this.signalementModel.countDocuments(filters);
    const signalements = await this.signalementModel
      .find(
        filters,
        {
          author: 0,
        },
        {
          skip: (pagination.page - 1) * pagination.limit,
          limit: pagination.limit,
          sort: { createdAt: -1 },
          lean: true,
        },
      )
      .populate('source', { _id: 1, nom: 1, type: 1 })
      .populate('processedBy', { _id: 1, nom: 1 });

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
  ): Promise<Signalement> {
    const newSignalement = await this.signalementModel.create({
      source: sourceId,
      ...createSignalementDTO,
    });

    return newSignalement.toObject();
  }

  async updateOne(
    clientId: string,
    signalementId: string,
    updateSignalementDTO: UpdateSignalementDTO,
  ): Promise<Signalement> {
    const { author, ...updatedSignalement } = await this.signalementModel
      .findByIdAndUpdate(
        signalementId,
        {
          status: updateSignalementDTO.status,
          processedBy: clientId,
        },
        {
          new: true,
          lean: true,
        },
      )
      .populate('source', { _id: 1, nom: 1, type: 1 })
      .populate('processedBy', { _id: 1, nom: 1 });

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
