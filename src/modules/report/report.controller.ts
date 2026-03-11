import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { In } from 'typeorm';
import { ReportService, ReportTypeEnum } from './report.service';
import { ReportStatusEnum } from '../../common/report-status.enum';
import { PaginatedReportsDTO } from './report.dto';

@Controller('reports')
@ApiTags('reports')
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get('')
  @ApiOperation({
    summary: 'Get paginated alerts and/or signalements',
    operationId: 'getReports',
  })
  @ApiQuery({
    name: 'codeCommunes',
    required: false,
    type: String,
    isArray: true,
  })
  @ApiQuery({
    name: 'sourceIds',
    required: false,
    type: String,
    isArray: true,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ReportStatusEnum,
    isArray: true,
    example: Object.keys(ReportStatusEnum),
  })
  @ApiQuery({
    name: 'types',
    required: false,
    enum: ReportTypeEnum,
    isArray: true,
    description:
      'Filter by specific type (MISSING_ADDRESS, LOCATION_TO_UPDATE, etc.)',
    example: Object.values(ReportTypeEnum),
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedReportsDTO })
  async getReports(
    @Res() res: Response,
    @Query('codeCommunes') codeCommunes: string | string[] = [],
    @Query('sourceIds') sourceIds: string | string[] = [],
    @Query('status') status: ReportStatusEnum | ReportStatusEnum[] = [],
    @Query('types') types: ReportTypeEnum | ReportTypeEnum[] = [],
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const filters: Record<string, any> = {};

    if (codeCommunes.length > 0) {
      filters.codeCommune = Array.isArray(codeCommunes)
        ? In(codeCommunes)
        : codeCommunes;
    }
    if (sourceIds.length > 0) {
      filters.source = Array.isArray(sourceIds) ? In(sourceIds) : sourceIds;
    }
    if (status.length > 0) {
      filters.status = Array.isArray(status) ? In(status) : status;
    }
    if (types.length > 0) {
      filters.type = Array.isArray(types) ? In(types) : types;
    }

    const pagination = {
      page: Number(page),
      limit: Number(limit) > 100 ? 100 : Number(limit),
    };
    const reports = await this.reportService.findMany(filters, pagination);

    res.status(HttpStatus.OK).json(reports);
  }
}
