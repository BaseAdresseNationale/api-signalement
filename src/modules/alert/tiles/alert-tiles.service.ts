import { Inject, Injectable, forwardRef } from '@nestjs/common';
import * as turf from '@turf/turf';
import * as GeoJSONVT from 'geojson-vt';
import { tileToBBOX } from '@mapbox/tilebelt';
import { AlertService } from '../alert.service';
import { AlertStatusEnum } from '../alert.types';

@Injectable()
export class AlertTilesService {
  constructor(
    @Inject(forwardRef(() => AlertService))
    private alertService: AlertService,
  ) {}

  public async getAlertTiles(
    {
      x,
      y,
      z,
    }: {
      x: number;
      y: number;
      z: number;
    },
    filters: { status?: AlertStatusEnum },
  ): Promise<GeoJSONVT.Tile | null> {
    const bbox: number[] = tileToBBOX([x, y, z]);

    const pendingAlerts = await this.alertService.findManyWhereInBBox(
      bbox,
      filters,
    );

    if (!pendingAlerts.length) {
      return null;
    }

    const alertGeoJSON = pendingAlerts.map((alert) => {
      const { point, ...rest } = alert;

      return turf.feature(point, rest);
    });

    const tiles = GeoJSONVT(
      {
        type: 'FeatureCollection',
        features: alertGeoJSON,
      },
      { maxZoom: 20 },
    ).getTile(z, x, y);

    return tiles;
  }
}
