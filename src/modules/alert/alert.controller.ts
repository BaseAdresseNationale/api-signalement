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
  UsePipes,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AlertStatusEnum, AlertTypeEnum } from './alert.types';
import { SourceGuard } from '../source/source.guard';
import { ClientGuard } from '../client/client.guard';
import { In } from 'typeorm';
import { Client } from '../client/client.entity';
import { promisify } from 'util';
import * as zlib from 'zlib';
import * as vtpbf from 'vt-pbf';
import { TrimPipe } from '../../common/trim.pipe';
import { Alert } from './alert.entity';
import {
  CreateAlertDTO,
  PaginatedAlertsDTO,
  UpdateAlertDTO,
} from './alert.dto';
import { AlertService } from './alert.service';
import { AlertTilesService } from './tiles/alert-tiles.service';

const gzip = promisify(zlib.gzip);

@Controller('alerts')
@ApiTags('alerts')
export class AlertController {
  constructor(
    private alertService: AlertService,
    private alertTilesService: AlertTilesService,
  ) {}

  @Get('')
  @ApiOperation({
    summary: 'Get alerts',
    operationId: 'getAlerts',
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
    enum: AlertTypeEnum,
    isArray: true,
    example: Object.keys(AlertTypeEnum),
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AlertStatusEnum,
    isArray: true,
    example: Object.keys(AlertStatusEnum),
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    type: PaginatedAlertsDTO,
  })
  async getAlerts(
    @Req() req: Request,
    @Res() res: Response,
    @Query('codeCommunes') codeCommunes: string | string[] = [],
    @Query('sourceIds') sourceIds: string | string[] = [],
    @Query('types') types: AlertTypeEnum | AlertTypeEnum[] = [],
    @Query('status') status: AlertStatusEnum | AlertStatusEnum[] = [],
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
    const alerts = await this.alertService.findMany(filters, pagination);

    res.status(HttpStatus.OK).json(alerts);
  }

  @Get('/tiles/:z/:x/:y.pbf')
  @ApiOperation({
    summary: 'Get tiles (with alerts features)',
    operationId: 'getTiles',
  })
  @ApiParam({ name: 'z', required: true, type: String })
  @ApiParam({ name: 'x', required: true, type: String })
  @ApiParam({ name: 'y', required: true, type: String })
  async getTiles(
    @Query('status') status: AlertStatusEnum,
    @Req() req: Request,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ) {
    const tiles = await this.alertTilesService.getAlertTiles(
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

    const pbf = vtpbf.fromGeojsonVt({ alerts: tiles });

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
    summary: 'Create a new alert',
    operationId: 'createAlert',
  })
  @ApiBody({ type: CreateAlertDTO, required: true })
  @ApiQuery({
    name: 'sourceId',
    required: false,
    type: String,
  })
  @ApiResponse({ status: HttpStatus.OK, type: Alert })
  @ApiBearerAuth('source-token')
  @UseGuards(SourceGuard)
  @UsePipes(new TrimPipe())
  async createAlert(
    @Req() req: Request & { source: { id: string } },
    @Body() createAlertDTO: CreateAlertDTO,
    @Res() res: Response,
  ) {
    const newAlert = await this.alertService.createOne(
      req.source.id,
      createAlertDTO,
    );

    res.status(HttpStatus.OK).json(newAlert);
  }

  @Get('/:idAlert')
  @ApiOperation({
    summary: 'Get alert by id',
    operationId: 'getAlertById',
    description:
      'Get an alert by its id, returns author info if client is authenticated',
  })
  @ApiParam({ name: 'idAlert', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Alert,
  })
  @ApiBearerAuth('client-token')
  async getAlertById(
    @Req() req: Request & { registeredClient: Client },
    @Res() res: Response,
    @Param('idAlert') idAlert: string,
  ) {
    const alert = await this.alertService.findOneOrFail(idAlert, {
      withAuthor: Boolean(req.registeredClient),
    });

    res.status(HttpStatus.OK).json(alert);
  }

  @Put('/:idAlert')
  @ApiOperation({
    summary: 'Update a given alert',
    operationId: 'updateAlert',
  })
  @ApiParam({ name: 'idAlert', required: true, type: String })
  @ApiBody({ type: UpdateAlertDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Alert })
  @ApiBearerAuth('client-token')
  @UseGuards(ClientGuard)
  async updateAlert(
    @Req() req: Request & { registeredClient: { id: string } },
    @Body() updateAlertDTO: UpdateAlertDTO,
    @Res() res: Response,
    @Param('idAlert') idAlert: string,
  ) {
    const updatedAlert = await this.alertService.updateOne(
      req.registeredClient.id,
      idAlert,
      updateAlertDTO,
    );

    res.status(HttpStatus.OK).json(updatedAlert);
  }
}
