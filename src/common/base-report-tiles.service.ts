import * as turf from '@turf/turf';
import * as GeoJSONVT from 'geojson-vt';
import { tileToBBOX } from '@mapbox/tilebelt';
import { BaseEntity } from './base.entity';
import { ReportStatusEnum } from './report-status.enum';
import { Point } from 'typeorm';

export interface ReportWithPoint extends BaseEntity {
  point?: Point;
  status: ReportStatusEnum;
}

export abstract class BaseReportTilesService<T extends ReportWithPoint> {
  protected abstract findManyWhereInBBox(
    bbox: number[],
    filters: { status?: ReportStatusEnum },
  ): Promise<T[]>;

  public async getTiles(
    { x, y, z }: { x: number; y: number; z: number },
    filters: { status?: ReportStatusEnum },
  ): Promise<GeoJSONVT.Tile | null> {
    const bbox: number[] = tileToBBOX([x, y, z]);

    const entities = await this.findManyWhereInBBox(bbox, filters);

    if (!entities.length) {
      return null;
    }

    const features = entities.map((entity) => {
      const { point, ...rest } = entity;
      return turf.feature(point, rest);
    });

    const tiles = GeoJSONVT(
      {
        type: 'FeatureCollection',
        features,
      },
      { maxZoom: 20 },
    ).getTile(z, x, y);

    return tiles;
  }
}
