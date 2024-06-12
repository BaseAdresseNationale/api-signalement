import {
  Body,
  Controller,
  Get,
  HttpStatus,
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
import { Source } from './source.schema';
import { CreateSourceDTO } from './source.dto';
import { SourceTypeEnum } from './source.types';
import { AdminGuard } from '../../common/admin.guard';

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

  @Get('/:id')
  @ApiOperation({
    summary: 'Get source by id',
    operationId: 'getSourceById',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Source,
  })
  @ApiParam({ name: 'id', required: true, type: String })
  async getSource(@Req() req: Request, @Res() res: Response) {
    const source = await this.sourceService.findOneOrFail(req.params.id);
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
