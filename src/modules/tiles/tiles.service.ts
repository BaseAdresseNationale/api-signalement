import { Injectable, Inject, forwardRef } from '@nestjs/common';
import * as turf from '@turf/turf';
import * as GeoJSONVT from 'geojson-vt';
import { tileToBBOX } from '@mapbox/tilebelt';
import { AlertService } from '../alert/alert.service';
import { SignalementService } from '../signalement/signalement.service';
import { ReportStatusEnum } from '../../common/report-status.enum';
import { BaseEntity } from '../../common/base.entity';
import { Point } from 'typeorm';

interface ReportWithPoint extends BaseEntity {
  point?: Point;
  status: ReportStatusEnum;
}

export enum TilesLayerEnum {
  ALERTS = 'alerts',
  SIGNALEMENTS = 'signalements',
}

@Injectable()
export class TilesService {
  constructor(
    @Inject(forwardRef(() => AlertService))
    private alertService: AlertService,
    @Inject(forwardRef(() => SignalementService))
    private signalementService: SignalementService,
  ) {}

  public async getTiles(
    { x, y, z }: { x: number; y: number; z: number },
    filters: { status?: ReportStatusEnum },
    layers: TilesLayerEnum[] = [
      TilesLayerEnum.ALERTS,
      TilesLayerEnum.SIGNALEMENTS,
    ],
  ): Promise<Record<string, GeoJSONVT.Tile> | null> {
    const bbox: number[] = tileToBBOX([x, y, z]);

    const layerTiles: Record<string, GeoJSONVT.Tile> = {};

    await Promise.all(
      layers.map(async (layer) => {
        const entities =
          layer === TilesLayerEnum.ALERTS
            ? await this.alertService.findManyWhereInBBox(bbox, filters)
            : await this.signalementService.findManyWhereInBBox(bbox, filters);

        if (!entities.length) {
          return;
        }

        const features = entities.map((entity: ReportWithPoint) => {
          const { point, ...rest } = entity;
          return turf.feature(point, rest);
        });

        const tile = GeoJSONVT(
          { type: 'FeatureCollection', features },
          { maxZoom: 20 },
        ).getTile(z, x, y);

        if (tile) {
          layerTiles[layer] = tile;
        }
      }),
    );

    return Object.keys(layerTiles).length > 0 ? layerTiles : null;
  }
}
