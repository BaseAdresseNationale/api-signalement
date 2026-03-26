import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as GeoJSONVT from 'geojson-vt';
import { SettingService } from './setting.service';
import { getCommune } from '../../utils/cog.utils';

interface CommuneFeature {
  codeCommune: string;
  nomCommune?: string;
  mode?: string;
  filteredSources?: string[];
}

@Injectable()
export class CommuneStatusCacheService implements OnModuleInit {
  private cachedFeatures: GeoJSON.Feature[] = [];
  private sourceTileIndexes = new Map<string, ReturnType<typeof GeoJSONVT>>();
  private readonly logger = new Logger(CommuneStatusCacheService.name);

  constructor(
    @Inject(forwardRef(() => SettingService))
    private readonly settingService: SettingService,
  ) {}

  async onModuleInit() {
    try {
      await this.buildCache();
    } catch (err) {
      this.logger.error(
        'Failed to build commune status cache on init',
        err.message,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshCache() {
    try {
      await this.buildCache();
    } catch (err) {
      this.logger.error('Failed to refresh commune status cache', err.message);
    }
  }

  private async buildCache() {
    this.logger.log('Building commune status cache...');

    const [statuses, contours] = await Promise.all([
      this.settingService.computeAllCommuneStatuses(),
      this.fetchCommuneContours(),
    ]);

    const features: GeoJSON.Feature[] = [];

    for (const [codeCommune, status] of statuses) {
      if (status.disabled) continue;

      const contour = contours.get(codeCommune);
      if (!contour) continue;

      const commune = getCommune(codeCommune);

      const properties: CommuneFeature = {
        codeCommune,
        nomCommune: commune?.nom,
        mode: status.mode,
      };

      if (status.filteredSources?.length) {
        properties.filteredSources = status.filteredSources;
      }

      features.push({
        type: 'Feature',
        geometry: contour,
        properties,
      });
    }

    this.cachedFeatures = features;
    this.sourceTileIndexes.clear();

    this.logger.log(
      `Commune status cache built: ${features.length} enabled communes`,
    );
  }

  private async fetchCommuneContours(): Promise<
    Map<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>
  > {
    const response = await fetch(
      'https://object.data.gouv.fr/contours-administratifs/2025/geojson/communes-100m.geojson',
    );
    const communes: GeoJSON.FeatureCollection = await response.json();

    const map = new Map<string, GeoJSON.Polygon | GeoJSON.MultiPolygon>();
    for (const commune of communes.features) {
      if (
        commune.geometry.type === 'Polygon' ||
        commune.geometry.type === 'MultiPolygon'
      ) {
        map.set(
          commune.properties.code,
          commune.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
        );
      }
    }

    return map;
  }

  private getSourceTileIndex(sourceId: string): ReturnType<typeof GeoJSONVT> {
    let index = this.sourceTileIndexes.get(sourceId);
    if (!index) {
      const filtered = this.cachedFeatures.filter((f) => {
        const props = f.properties as CommuneFeature;
        return !props.filteredSources?.includes(sourceId);
      });
      index = GeoJSONVT(
        { type: 'FeatureCollection', features: filtered },
        { maxZoom: 10, indexMaxZoom: 10, tolerance: 0, buffer: 64 },
      );
      this.sourceTileIndexes.set(sourceId, index);
    }
    return index;
  }

  getTileForSource(
    z: number,
    x: number,
    y: number,
    sourceId: string,
  ): GeoJSONVT.Tile | null {
    if (!this.cachedFeatures.length) return null;
    const index = this.getSourceTileIndex(sourceId);
    return index.getTile(z, x, y);
  }
}
