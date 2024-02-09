import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Signalement } from 'src/modules/signalement/schemas/signalement.schema';
import { CreateSignalementDTO } from './signalement.dto';

@Injectable()
export class SignalementService {
  constructor(
    @InjectModel(Signalement.name) private signalementModel: Model<Signalement>,
  ) {}

  async getByCodeCommune(codeCommune: string): Promise<Signalement[]> {
    return this.signalementModel.find({ codeCommune }).lean();
  }

  async createOne(
    createSignalementDTO: CreateSignalementDTO,
  ): Promise<Signalement> {
    const newSignalement =
      await this.signalementModel.create(createSignalementDTO);

    return newSignalement.toObject();
  }
}
