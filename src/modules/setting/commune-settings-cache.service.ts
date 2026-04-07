import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettingService } from './setting.service';
import { SignalementSubmissionMode } from './setting.type';

export type CommuneSettingsMap = Record<
  string,
  {
    disabled: boolean;
    mode?: SignalementSubmissionMode;
    filteredSources?: string[];
  }
>;

@Injectable()
export class CommuneSettingsCacheService implements OnModuleInit {
  private cachedSettings: CommuneSettingsMap | null = null;
  private readonly logger = new Logger(CommuneSettingsCacheService.name);

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

    const statuses = await this.settingService.computeAllCommuneStatuses();

    const result: CommuneSettingsMap = {};
    for (const [codeCommune, status] of statuses) {
      result[codeCommune] = status;
    }

    this.cachedSettings = result;

    this.logger.log(
      `Commune settings cache ready with ${Object.keys(result).length} communes`,
    );
  }

  getCachedSettings(): CommuneSettingsMap | null {
    return this.cachedSettings;
  }
}
