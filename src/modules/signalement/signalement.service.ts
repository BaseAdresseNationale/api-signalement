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

@Injectable()
export class SignalementService {
  constructor(
    @InjectModel(Signalement.name) private signalementModel: Model<Signalement>,
  ) {}

  async findOneOrFail(id: string): Promise<Signalement> {
    const signalement = await this.signalementModel.findById(id).lean();
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
    await this.signalementModel.updateOne(
      { _id: updateSignalementDTO.id },
      {
        status: updateSignalementDTO.status,
        processedBy: clientId,
      },
    );

    // TODO : Notification to author

    return this.findOneOrFail(updateSignalementDTO.id);
  }
}
