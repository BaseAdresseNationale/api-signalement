import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateSourceDTO, UpdateSourceDTO } from './source.dto';
import { SourceTypeEnum } from './source.types';
import { Source } from './source.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { getCols } from '../../utils/repository.utils';

@Injectable()
export class SourceService {
  constructor(
    @InjectRepository(Source)
    private readonly sourceRepository: Repository<Source>,
  ) {}

  async findOneOrFail(
    id: string,
    options?: { withAuthor?: boolean },
  ): Promise<Source> {
    const { withAuthor = false } = options || {};
    const source = await this.sourceRepository.findOne({
      where: { id },
      ...(withAuthor && { select: getCols(this.sourceRepository) }),
    });
    if (!source) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return source;
  }

  async findOneOrFailByToken(token: string): Promise<Source> {
    const source = await this.sourceRepository.findOne({
      where: { token },
      select: getCols(this.sourceRepository),
    });
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

  async findOneBySiret(siret: string): Promise<Source | null> {
    return this.sourceRepository.findOne({ where: { siret } });
  }

  async createOne(createSourceDTO: CreateSourceDTO): Promise<Source> {
    const newSource = new Source(createSourceDTO);

    return this.sourceRepository.save(newSource);
  }

  async updateOne(
    id: string,
    updateSourceDTO: UpdateSourceDTO,
  ): Promise<Source> {
    const source = await this.findOneOrFail(id);

    if (
      updateSourceDTO.defaultAuthor !== undefined &&
      source.type !== SourceTypeEnum.PRIVATE
    ) {
      throw new HttpException(
        'defaultAuthor can only be set on PRIVATE sources',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (updateSourceDTO.nom !== undefined) {
      source.nom = updateSourceDTO.nom;
    }
    if (updateSourceDTO.defaultAuthor !== undefined) {
      source.defaultAuthor = updateSourceDTO.defaultAuthor;
    }

    return this.sourceRepository.save(source);
  }

  async findOneWithToken(id: string): Promise<Source> {
    const source = await this.sourceRepository
      .createQueryBuilder('source')
      .addSelect('source.token')
      .where('source.id = :id', { id })
      .getOne();

    if (!source) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    return source;
  }
}
