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

@Injectable()
export class CommuneStatusCacheService implements OnModuleInit {
  private cachedIndex: ReturnType<typeof GeoJSONVT> = null;
  private communesWithContours: GeoJSON.FeatureCollection = null;
  private readonly logger = new Logger(CommuneStatusCacheService.name);

  constructor(
    @Inject(forwardRef(() => SettingService))
    private readonly settingService: SettingService,
  ) {}

  async onModuleInit() {
    try {
      this.communesWithContours = await this.fetchCommuneContours();
      await this.buildCache(this.communesWithContours);
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
      await this.buildCache(this.communesWithContours);
    } catch (err) {
      this.logger.error('Failed to refresh commune status cache', err.message);
    }
  }

  private async buildCache(communes?: GeoJSON.FeatureCollection) {
    this.logger.log('Building commune status cache...');

    if (!communes) {
      communes = await this.fetchCommuneContours();
    }

    const statuses = await this.settingService.computeAllCommuneStatuses();

    const features: GeoJSON.Feature[] = [];

    for (const feature of communes.features) {
      const { geometry, properties } = feature;
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
        continue; // Skip non-polygon geometries
      }
      const codeCommune = properties.code;
      const status = statuses.get(codeCommune);

      if (status) {
        const { disabled, mode, filteredSources } = status;
        properties.disabled = disabled;
        if (mode) {
          properties.mode = mode;
        }
        if (filteredSources) {
          properties.filteredSources = filteredSources;
        }
      } else {
        properties.disabled = true; // Default to disabled if no specific status
      }

      features.push({
        type: 'Feature',
        geometry,
        properties,
      });
    }

    this.cachedIndex = GeoJSONVT(
      { type: 'FeatureCollection', features },
      { maxZoom: 11, indexMaxZoom: 11 },
    );

    this.logger.log(
      `Commune status index cache ready with ${features.length} features`,
    );
  }

  private async fetchCommuneContours(): Promise<GeoJSON.FeatureCollection> {
    this.logger.log('Fetching commune contours...');

    const response = await fetch(
      'https://object.data.gouv.fr/contours-administratifs/2025/geojson/communes-1000m.geojson',
    );
    const communes: GeoJSON.FeatureCollection = await response.json();

    return communes;
  }

  getTileForSource(z: number, x: number, y: number): GeoJSONVT.Tile | null {
    if (!this.cachedIndex) return null;
    return this.cachedIndex.getTile(z, x, y);
  }
}
