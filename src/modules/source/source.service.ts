import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateSourceDTO } from './source.dto';
import { SourceTypeEnum } from './source.types';
import { SourceEntity } from './source.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SourceService {
  constructor(
    @InjectRepository(SourceEntity)
    private readonly sourceRepository: Repository<SourceEntity>,
  ) {}

  async findOneOrFail(id: string): Promise<SourceEntity> {
    const source = await this.sourceRepository.findOne({ where: { id } });
    if (!source) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return source;
  }

  async findOneOrFailByToken(token: string): Promise<SourceEntity> {
    const source = await this.sourceRepository.findOne({ where: { token } });
    if (!source) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return source;
  }

  async findMany(filters: { type?: SourceTypeEnum }): Promise<SourceEntity[]> {
    const sources = await this.sourceRepository.find({
      where: filters,
      withDeleted: false,
    });

    return sources;
  }

  async createOne(createSourceDTO: CreateSourceDTO): Promise<SourceEntity> {
    const newSource = new SourceEntity(createSourceDTO);

    return this.sourceRepository.save(newSource);
  }
}
