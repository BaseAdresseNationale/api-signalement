import {
  Body,
  Controller,
  Get,
  HttpStatus,
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

  @Get(':codeCommune')
  @ApiOperation({
    summary: 'Get all signalements for a given codeCommune',
    operationId: 'getSignalementsByCodeCommune',
  })
  @ApiParam({ name: 'codeCommune', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sourceId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: SignalementTypeEnum })
  @ApiQuery({ name: 'status', required: false, enum: SignalementStatusEnum })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Array<Signalement>,
  })
  async getSignalements(
    @Req() req: Request,
    @Res() res: Response,
    @Query('sourceId') sourceId: string,
    @Query('type') type: SignalementTypeEnum,
    @Query('status') status: SignalementStatusEnum,
    @Query('page') page = 1,
    @Query('limit') limit = 1000,
  ) {
    const { codeCommune } = req.params;
    const filters = { codeCommune };
    if (sourceId) {
      filters['sourceId'] = sourceId;
    }
    if (type) {
      filters['type'] = type;
    }
    if (status) {
      filters['status'] = status;
    } else {
      filters['status'] = SignalementStatusEnum.PENDING;
    }
    const pagination = { page, limit: limit > 1000 ? 1000 : limit };
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

  @Put('')
  @ApiOperation({
    summary: 'Update a given signalement',
    operationId: 'updateSignalement',
  })
  @ApiBody({ type: UpdateSignalementDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Signalement })
  @ApiBearerAuth('client-token')
  @UseGuards(ClientGuard)
  async updateSignalement(
    @Req() req: Request & { client: { _id: string } },
    @Body() updateSignalementDTO: UpdateSignalementDTO,
    @Res() res: Response,
  ) {
    const updatedSignalement = await this.signalementService.updateOne(
      req.client._id,
      updateSignalementDTO,
    );

    res.status(HttpStatus.OK).json(updatedSignalement);
  }
}
