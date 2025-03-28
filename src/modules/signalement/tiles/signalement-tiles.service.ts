import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SignalementService } from '../signalement.service';
import { SignalementStatusEnum } from '../signalement.types';
import * as turf from '@turf/turf';
import * as GeoJSONVT from 'geojson-vt';
import { tileToBBOX } from '@mapbox/tilebelt';

@Injectable()
export class SignalementTilesService {
  constructor(
    @Inject(forwardRef(() => SignalementService))
    private signalementService: SignalementService,
  ) {}

  public async getSignalementTiles(
    {
      x,
      y,
      z,
    }: {
      x: number;
      y: number;
      z: number;
    },
    filters: { status?: SignalementStatusEnum },
  ): Promise<GeoJSONVT.Tile | null> {
    const bbox: number[] = tileToBBOX([x, y, z]);

    const pendingSignalements =
      await this.signalementService.findManyWhereInBBox(bbox, filters);

    if (!pendingSignalements.length) {
      return null;
    }

    const signalementGeoJSON = pendingSignalements.map((signalement) => {
      const { point, ...rest } = signalement;

      return turf.feature(point, rest);
    });

    const tiles = GeoJSONVT(
      {
        type: 'FeatureCollection',
        features: signalementGeoJSON,
      },
      { maxZoom: 20 },
    ).getTile(z, x, y);

    return tiles;
  }
}
