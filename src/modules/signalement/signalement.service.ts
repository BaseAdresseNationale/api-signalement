import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Signalement } from 'src/modules/signalement/schemas/signalement.schema';
import {
  CreateSignalementDTO,
  UpdateSignalementDTO,
} from './dto/signalement.dto';

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

  async getByCodeCommune(codeCommune: string): Promise<Signalement[]> {
    return (await this.signalementModel.find({ codeCommune }).lean()).filter(
      ({ processedAt }) => !processedAt,
    );
  }

  async createOne(
    createSignalementDTO: CreateSignalementDTO,
  ): Promise<Signalement> {
    const newSignalement =
      await this.signalementModel.create(createSignalementDTO);

    return newSignalement.toObject();
  }

  async updateOne(
    updateSignalementDTO: UpdateSignalementDTO,
  ): Promise<Signalement> {
    await this.signalementModel.updateOne(
      { _id: updateSignalementDTO.id },
      {
        processedAt: new Date(),
      },
    );

    return this.findOneOrFail(updateSignalementDTO.id);
  }
}
