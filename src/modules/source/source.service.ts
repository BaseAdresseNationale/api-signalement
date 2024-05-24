import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSourceDTO } from './source.dto';
import { SourceTypeEnum } from './source.types';
import { Source } from './source.schema';

@Injectable()
export class SourceService {
  constructor(@InjectModel(Source.name) private sourceModel: Model<Source>) {}

  async findOneOrFail(id: string): Promise<Source> {
    const Source = await this.sourceModel.findById(id).lean();
    if (!Source) {
      throw new Error('Source not found');
    }
    return Source;
  }

  async findOneOrFailByToken(token: string): Promise<Source> {
    const source = await this.sourceModel.findOne({ token }).lean();
    if (!source) {
      throw new Error('Source not found');
    }

    return source;
  }

  async findMany(filters: { type?: SourceTypeEnum }): Promise<Source[]> {
    return this.sourceModel
      .find(filters, { _id: 1, nom: 1, type: 1 }, { lean: true })
      .exec();
  }

  async createOne(createSourceDTO: CreateSourceDTO): Promise<Source> {
    const newSource = await this.sourceModel.create(createSourceDTO);

    return newSource.toObject();
  }
}
