import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateSourceDTO } from './source.dto';
import { SourceTypeEnum } from './source.types';
import { Source } from './source.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SourceService {
  constructor(
    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,
  ) {}

  async findOneOrFail(id: string): Promise<Source> {
    const source = await this.sourceRepository.findOne({ where: { id } });
    if (!source) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return source;
  }

  async findOneOrFailByToken(token: string): Promise<Source> {
    const source = await this.sourceRepository.findOne({ where: { token } });
    if (!source) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return source;
  }

  async findMany(filters: { type?: SourceTypeEnum }): Promise<Source[]> {
    const sources = await this.sourceRepository.find({
      where: filters,
      withDeleted: false,
    });

    return sources;
  }

  async createOne(createSourceDTO: CreateSourceDTO): Promise<Source> {
    const newSource = new Source(createSourceDTO);

    return this.sourceRepository.save(newSource);
  }
}
