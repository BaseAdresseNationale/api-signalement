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
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from './signalement.types';
import { SourceGuard } from '../source/source.guard';
import { ClientGuard } from '../client/client.guard';
import { Signalement } from './signalement.entity';
import { In } from 'typeorm';
import { Client } from '../client/client.entity';
import { promisify } from 'util';
import * as zlib from 'zlib';
import * as vtpbf from 'vt-pbf';
import { SignalementTilesService } from './tiles/signalement-tiles.service';

const gzip = promisify(zlib.gzip);

@Controller('signalements')
@ApiTags('signalements')
export class SignalementController {
  constructor(
    private signalementService: SignalementService,
    private signalementTilesService: SignalementTilesService,
  ) {}

  @Get('')
  @ApiOperation({
    summary: 'Get signalements',
    operationId: 'getSignalements',
  })
  @ApiQuery({
    name: 'codeCommunes',
    required: false,
    type: String,
    isArray: true,
  })
  @ApiQuery({ name: 'sourceIds', required: false, type: String, isArray: true })
  @ApiQuery({
    name: 'types',
    required: false,
    enum: SignalementTypeEnum,
    isArray: true,
    example: Object.keys(SignalementTypeEnum),
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: SignalementStatusEnum,
    isArray: true,
    example: Object.keys(SignalementStatusEnum),
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PaginatedSignalementsDTO,
  })
  async getSignalements(
    @Req() req: Request,
    @Res() res: Response,
    @Query('codeCommunes') codeCommunes: string | string[] = [],
    @Query('sourceIds') sourceIds: string | string[] = [],
    @Query('types') types: SignalementTypeEnum | SignalementTypeEnum[] = [],
    @Query('status') status: SignalementTypeEnum | SignalementStatusEnum[] = [],
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const filters = {};

    if (codeCommunes.length > 0) {
      filters['codeCommune'] = Array.isArray(codeCommunes)
        ? In(codeCommunes)
        : codeCommunes;
    }
    if (sourceIds.length > 0) {
      filters['source'] = Array.isArray(sourceIds) ? In(sourceIds) : sourceIds;
    }
    if (types.length > 0) {
      filters['type'] = Array.isArray(types) ? In(types) : types;
    }
    if (status.length > 0) {
      filters['status'] = Array.isArray(status) ? In(status) : status;
    }
    const pagination = { page, limit: limit > 100 ? 100 : limit };
    const signalements = await this.signalementService.findMany(
      filters,
      pagination,
    );

    res.status(HttpStatus.OK).json(signalements);
  }

  @Get('/tiles/:z/:x/:y.pbf')
  @ApiOperation({
    summary: 'Get tiles (with signalements features)',
    operationId: 'getTiles',
  })
  @ApiParam({ name: 'z', required: true, type: String })
  @ApiParam({ name: 'x', required: true, type: String })
  @ApiParam({ name: 'y', required: true, type: String })
  async getTiles(
    @Query('status') status: SignalementStatusEnum,
    @Req() req: Request,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ) {
    const tiles = await this.signalementTilesService.getSignalementTiles(
      {
        z: parseInt(z),
        x: parseInt(x),
        y: parseInt(y),
      },
      {
        status,
      },
    );

    if (!tiles) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    const pbf = vtpbf.fromGeojsonVt({ signalements: tiles });

    const compressedPbf = await gzip(Buffer.from(pbf));

    return res
      .set({
        'Content-Type': 'application/x-protobuf',
        'Content-Encoding': 'gzip',
      })
      .send(compressedPbf);
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
    @Req() req: Request & { source: { id: string } },
    @Body() createSignalementDTO: CreateSignalementDTO,
    @Res() res: Response,
  ) {
    const newSignalement = await this.signalementService.createOne(
      req.source.id,
      createSignalementDTO,
    );

    res.status(HttpStatus.OK).json(newSignalement);
  }

  @Get('/:idSignalement')
  @ApiOperation({
    summary: 'Get signalement by id',
    operationId: 'getSignalementById',
    description:
      'Get a signalement by its id, returns author info if client is authenticated',
  })
  @ApiParam({ name: 'idSignalement', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Signalement,
  })
  @ApiBearerAuth('client-token')
  async getSignalementById(
    @Req() req: Request & { registeredClient: Client },
    @Res() res: Response,
    @Param('idSignalement') idSignalement: string,
  ) {
    const signalement = await this.signalementService.findOneOrFail(
      idSignalement,
      { withAuthor: Boolean(req.registeredClient) },
    );

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
    @Req() req: Request & { registeredClient: { id: string } },
    @Body() updateSignalementDTO: UpdateSignalementDTO,
    @Res() res: Response,
    @Param('idSignalement') idSignalement: string,
  ) {
    const updatedSignalement = await this.signalementService.updateOne(
      req.registeredClient.id,
      idSignalement,
      updateSignalementDTO,
    );

    res.status(HttpStatus.OK).json(updatedSignalement);
  }
}
