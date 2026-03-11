import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './report.entity';
import { AlertTypeEnum } from '../alert/alert.types';
import { SignalementTypeEnum } from '../signalement/signalement.types';
import { PaginatedResult } from '../../common/dto/paginated-result.dto';

export const ReportTypeEnum = { ...AlertTypeEnum, ...SignalementTypeEnum };
export type ReportTypeEnum = AlertTypeEnum | SignalementTypeEnum;

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async findMany(
    filters: {
      codeCommune?: any;
      source?: any;
      status?: any;
      type?: any;
    },
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResult<Report>> {
    const where: Record<string, any> = {};

    if (filters.codeCommune) {
      where.codeCommune = filters.codeCommune;
    }
    if (filters.source) {
      where.source = { id: filters.source };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const [data, total] = await this.reportRepository.findAndCount({
      where,
      relations: ['source', 'processedBy'],
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }
}
