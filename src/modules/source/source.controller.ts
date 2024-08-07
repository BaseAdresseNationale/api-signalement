import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SourceService } from './source.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateSourceDTO } from './source.dto';
import { SourceTypeEnum } from './source.types';
import { AdminGuard } from '../../common/admin.guard';
import { Source } from './source.entity';

@ApiTags('sources')
@Controller('sources')
export class SourceController {
  constructor(private sourceService: SourceService) {}

  @Get('')
  @ApiOperation({
    summary: 'Get all sources',
    operationId: 'getSources',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Array<Source>,
  })
  @ApiQuery({ name: 'type', required: false, enum: SourceTypeEnum })
  async getSources(
    @Req() req: Request,
    @Res() res: Response,
    @Query('type') type: SourceTypeEnum,
  ) {
    const filters = {};
    if (type) {
      filters['type'] = type;
    }
    const sources = await this.sourceService.findMany(filters);

    res.status(HttpStatus.OK).json(sources);
  }

  @Get('/:idSource')
  @ApiOperation({
    summary: 'Get source by id',
    operationId: 'getSourceById',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Source,
  })
  @ApiParam({ name: 'idSource', required: true, type: String })
  async getSourceById(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idSource') idSource: string,
  ) {
    const source = await this.sourceService.findOneOrFail(idSource);
    res.status(HttpStatus.OK).json(source);
  }

  @Get('/token/:token')
  @ApiOperation({
    summary: 'Get source by token',
    operationId: 'getSourceByToken',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Source,
  })
  @ApiParam({ name: 'token', required: true, type: String })
  async getSourceByToken(
    @Req() req: Request,
    @Res() res: Response,
    @Param('token') token: string,
  ) {
    const source = await this.sourceService.findOneOrFailByToken(token);
    res.status(HttpStatus.OK).json(source);
  }

  @Post('')
  @ApiOperation({
    summary: 'Create a new source',
    operationId: 'createSource',
  })
  @ApiBody({ type: CreateSourceDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Source })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async createSource(
    @Req() req: Request,
    @Body() createSourceDTO: CreateSourceDTO,
    @Res() res: Response,
  ) {
    const newSource = await this.sourceService.createOne(createSourceDTO);

    res.status(HttpStatus.OK).json(newSource);
  }
}
