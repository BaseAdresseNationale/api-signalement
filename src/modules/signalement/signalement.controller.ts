import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SignalementService } from './signalement.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateSignalementDTO,
  PaginatedSignalementsDTO,
  UpdateSignalementDTO,
} from './dto/signalement.dto';
import { Signalement } from './schemas/signalement.schema';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from './signalement.types';
import { SourceGuard } from '../source/source.guard';
import { ClientGuard } from '../client/client.guard';

@Controller('signalements')
@ApiTags('signalements')
export class SignalementController {
  constructor(private signalementService: SignalementService) {}

  @Get('')
  @ApiOperation({
    summary: 'Get signalements',
    operationId: 'getSignalements',
  })
  @ApiQuery({ name: 'codeCommune', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sourceId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: SignalementTypeEnum })
  @ApiQuery({ name: 'status', required: false, enum: SignalementStatusEnum })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PaginatedSignalementsDTO,
  })
  async getSignalements(
    @Req() req: Request,
    @Res() res: Response,
    @Query('codeCommune') codeCommune: string,
    @Query('sourceId') sourceId: string,
    @Query('type') type: SignalementTypeEnum,
    @Query('status') status: SignalementStatusEnum,
    @Query('page') page = 1,
    @Query('limit') limit = 100,
  ) {
    const filters = {};

    if (codeCommune) {
      filters['codeCommune'] = codeCommune;
    }
    if (sourceId) {
      filters['source'] = sourceId;
    }
    if (type) {
      filters['type'] = type;
    }
    if (status) {
      filters['status'] = status;
    }
    const pagination = { page, limit: limit > 100 ? 100 : limit };
    const signalements = await this.signalementService.findMany(
      filters,
      pagination,
    );

    res.status(HttpStatus.OK).json(signalements);
  }

  @Post('')
  @ApiOperation({
    summary: 'Create a new signalement',
    operationId: 'createSignalement',
  })
  @ApiBody({ type: CreateSignalementDTO, required: true })
  @ApiQuery({
    name: 'sourceId',
    required: false,
    type: String,
  })
  @ApiResponse({ status: HttpStatus.OK, type: Signalement })
  @ApiBearerAuth('source-token')
  @UseGuards(SourceGuard)
  async createSignalement(
    @Req() req: Request & { source: { _id: string } },
    @Body() createSignalementDTO: CreateSignalementDTO,
    @Res() res: Response,
  ) {
    const newSignalement = await this.signalementService.createOne(
      req.source._id,
      createSignalementDTO,
    );

    res.status(HttpStatus.OK).json(newSignalement);
  }

  @Get('/:idSignalement')
  @ApiOperation({
    summary: 'Get signalement by id',
    operationId: 'getSignalementById',
  })
  @ApiParam({ name: 'idSignalement', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Signalement,
  })
  async getSignalementById(
    @Req() req: Request,
    @Res() res: Response,
    @Param('idSignalement') idSignalement: string,
  ) {
    const signalement =
      await this.signalementService.findOneOrFail(idSignalement);
    res.status(HttpStatus.OK).json(signalement);
  }

  @Put('/:idSignalement')
  @ApiOperation({
    summary: 'Update a given signalement',
    operationId: 'updateSignalement',
  })
  @ApiParam({ name: 'idSignalement', required: true, type: String })
  @ApiBody({ type: UpdateSignalementDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Signalement })
  @ApiBearerAuth('client-token')
  @UseGuards(ClientGuard)
  async updateSignalement(
    @Req() req: Request & { registeredClient: { _id: string } },
    @Body() updateSignalementDTO: UpdateSignalementDTO,
    @Res() res: Response,
    @Param('idSignalement') idSignalement: string,
  ) {
    const updatedSignalement = await this.signalementService.updateOne(
      req.registeredClient._id,
      idSignalement,
      updateSignalementDTO,
    );

    res.status(HttpStatus.OK).json(updatedSignalement);
  }
}
