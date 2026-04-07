import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { promisify } from 'util';
import * as zlib from 'zlib';
import * as vtpbf from 'vt-pbf';
import { TilesService, TilesLayerEnum } from './tiles.service';
import { ReportStatusEnum } from '../../common/report-status.enum';

const gzip = promisify(zlib.gzip);

@Controller('tiles')
@ApiTags('tiles')
export class TilesController {
  constructor(private tilesService: TilesService) {}

  @Get('/:z/:x/:y.pbf')
  @ApiOperation({
    summary: 'Get vector tiles with alerts and/or signalements features',
    operationId: 'getTiles',
  })
  @ApiParam({ name: 'z', required: true, type: String })
  @ApiParam({ name: 'x', required: true, type: String })
  @ApiParam({ name: 'y', required: true, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ReportStatusEnum,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'layers',
    required: false,
    enum: TilesLayerEnum,
    isArray: true,
    description:
      'Layers to include in the tiles (defaults to alerts and signalements)',
    example: [TilesLayerEnum.ALERTS, TilesLayerEnum.SIGNALEMENTS],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PBF vector tile with requested layers',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'No data for this tile',
  })
  async getTiles(
    @Query('status') status: ReportStatusEnum,
    @Query('layers') layers: TilesLayerEnum | TilesLayerEnum[],
    @Req() req: Request,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ) {
    const parsedLayers = layers
      ? Array.isArray(layers)
        ? layers
        : [layers]
      : [TilesLayerEnum.ALERTS, TilesLayerEnum.SIGNALEMENTS];

    const layerTiles = await this.tilesService.getTiles(
      {
        z: parseInt(z),
        x: parseInt(x),
        y: parseInt(y),
      },
      { status },
      parsedLayers,
    );

    if (!layerTiles) {
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    const pbf = vtpbf.fromGeojsonVt(layerTiles);

    const compressedPbf = await gzip(Buffer.from(pbf));

    return res
      .set({
        'Content-Type': 'application/x-protobuf',
        'Content-Encoding': 'gzip',
      })
      .send(compressedPbf);
  }
}
