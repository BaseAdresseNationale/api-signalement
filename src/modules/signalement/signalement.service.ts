import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from './signalement.types';
import {
  CreateSignalementDTO,
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
      .lean();
    if (!signalement) {
      throw new Error('Signalement not found');
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
  ): Promise<Signalement[]> {
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
      .populate('processedBy', { _id: 1, nom: 1 })
      .exec();

    return signalements;
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
    updateSignalementDTO: UpdateSignalementDTO,
  ): Promise<Signalement> {
    const updatedSignalement = await this.signalementModel.findByIdAndUpdate(
      updateSignalementDTO.id,
      {
        status: updateSignalementDTO.status,
        processedBy: clientId,
      },
      {
        new: true,
        lean: true,
      },
    );

    if (updatedSignalement.author?.email) {
      this.mailerService.sendMail({
        to: updatedSignalement.author.email,
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
