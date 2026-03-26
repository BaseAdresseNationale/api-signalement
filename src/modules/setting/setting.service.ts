import { Injectable, NotFoundException } from '@nestjs/common';
import { Like, Repository } from 'typeorm';
import { Revision } from '../api-depot/api-depot.types';
import { InjectRepository } from '@nestjs/typeorm';
import { Setting } from './setting.entity';
import { ApiDepotService } from '../api-depot/api-depot.service';
import { EnabledListKeys, SignalementSubmissionMode } from './setting.type';
import { CommuneSettingsDTO } from './dto/commune-settings.dto';
import { CommuneStatusDTO } from './dto/commune-status.dto';
import { SourceService } from '../source/source.service';
import { EnabledListDTO } from './dto/enabled-list.dto';
import { CommuneStatusCacheService } from './commune-status-cache.service';

const ObjectIdRE = new RegExp('^[0-9a-fA-F]{24}$');

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
    private readonly apiDepotService: ApiDepotService,
    private readonly sourceService: SourceService,
    private readonly communeStatusCacheService: CommuneStatusCacheService,
  ) {}

  getCommuneSettingsKey(codeCommune: string): string {
    return `${codeCommune}-settings`;
  }

  async getCommuneStatus(
    codeCommune: string,
    sourceId: string,
  ): Promise<CommuneStatusDTO> {
    // Check source id
    await this.sourceService.findOneOrFail(sourceId);

    // First check if the commune is in the disabled list
    const setting = await this.settingsRepository.findOne({
      where: { name: this.getCommuneSettingsKey(codeCommune) },
    });

    const communesSettings = setting?.content as CommuneSettingsDTO;

    if (communesSettings) {
      if (communesSettings.disabled) {
        return {
          disabled: true,
          message:
            communesSettings.message ||
            'La commune a demandé la désactivation du dépôt de signalements. Nous vous recommandons de contacter directement la mairie.',
        };
      } else if (communesSettings.filteredSources?.includes(sourceId)) {
        return {
          disabled: true,
          message:
            communesSettings.message ||
            'La commune a demandé la désactivation de cette source de signalements. Nous vous recommandons de contacter directement la mairie.',
        };
      } else {
        return {
          disabled: false,
          mode: communesSettings.mode || SignalementSubmissionMode.FULL,
        };
      }
    }

    // Then get current revision to know how commune is published
    const currentRevision =
      await this.apiDepotService.getCurrentRevision(codeCommune);

    // If the commune is not published, signalement is disabled
    if (!currentRevision) {
      return {
        disabled: true,
        message:
          "Les signalements ne peuvent pas être proposés sur cette commune car elle n'a pas publié sa Base Adresse Locale. Nous vous recommandons de contacter directement la mairie.",
      };
    }

    // If commune is published via mes-adresses, signalement is enabled
    if (
      currentRevision?.context?.extras?.balId &&
      ObjectIdRE.test(currentRevision.context.extras.balId)
    ) {
      return {
        disabled: false,
        mode: SignalementSubmissionMode.FULL,
      };
    }

    // If the commune is published via moissonneur, check if the source is in the white list
    if (currentRevision?.context?.extras?.sourceId) {
      const moissonneurSourceWhiteList = await this.settingsRepository.findOne({
        where: { name: EnabledListKeys.SOURCES_MOISSONNEUR_ENABLED },
      });

      const moissonneurSourceWhiteListContent =
        moissonneurSourceWhiteList.content as string[];

      const isSourceEnabled = moissonneurSourceWhiteListContent.includes(
        currentRevision.context.extras.sourceId,
      );

      if (isSourceEnabled) {
        return {
          disabled: false,
          mode: SignalementSubmissionMode.LIGHT,
        };
      } else {
        return {
          disabled: true,
          message:
            'Cette commune ne gère pas encore la prise en compte des signalements depuis notre site. Nous vous recommandons de contacter directement la mairie.',
        };
      }
    }

    // If the commune is published via API depot, check if the client is in the white list
    if (currentRevision?.client?.id) {
      const apiDepotClientEnabled = await this.settingsRepository.findOne({
        where: { name: EnabledListKeys.API_DEPOT_CLIENTS_ENABLED },
      });

      const apiDepotClientEnabledContent =
        apiDepotClientEnabled.content as string[];

      const isClientEnabled = apiDepotClientEnabledContent.includes(
        currentRevision.client.id,
      );

      if (isClientEnabled) {
        return {
          disabled: false,
          mode: SignalementSubmissionMode.LIGHT,
        };
      } else {
        return {
          disabled: true,
          message:
            'Cette commune ne gère pas encore la prise en compte des signalements depuis notre site. Nous vous recommandons de contacter directement la mairie.',
        };
      }
    }

    return {
      disabled: true,
    };
  }

  async getCommuneSettings(
    codeCommune: string,
  ): Promise<CommuneSettingsDTO | null> {
    const setting = await this.settingsRepository.findOne({
      where: { name: this.getCommuneSettingsKey(codeCommune) },
    });

    return (setting?.content as CommuneSettingsDTO) || null;
  }

  async deleteCommuneSettings(codeCommune: string): Promise<void> {
    const key = this.getCommuneSettingsKey(codeCommune);

    const setting = await this.settingsRepository.findOne({
      where: { name: key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting for ${codeCommune} not found`);
    }

    await this.settingsRepository.remove(setting);
  }

  async setCommuneSettings(
    codeCommune: string,
    settings: CommuneSettingsDTO,
  ): Promise<CommuneSettingsDTO> {
    const key = this.getCommuneSettingsKey(codeCommune);

    let setting = await this.settingsRepository.findOne({
      where: { name: key },
    });

    if (!setting) {
      setting = new Setting({ name: key, content: settings });
    } else {
      setting.content = settings;
    }

    await this.settingsRepository.save(setting);

    this.communeStatusCacheService.refreshCache();

    return setting.content as CommuneSettingsDTO;
  }

  async isInEnabledList(key: EnabledListKeys, id: string): Promise<boolean> {
    const setting = await this.settingsRepository.findOne({
      where: { name: key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting ${key} not found`);
    }

    const enabledList = setting.content as string[];

    return enabledList.includes(id);
  }

  async updateEnabledList(
    key: EnabledListKeys,
    enabledListDTO: EnabledListDTO,
  ): Promise<string[]> {
    const { id } = enabledListDTO;
    const setting = await this.settingsRepository.findOne({
      where: { name: key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting ${key} not found`);
    }

    const enabledList = setting.content as string[];
    let updatedEnabledList: string[] = [];

    if (!enabledList.includes(id)) {
      updatedEnabledList = [...enabledList, id];
      setting.content = updatedEnabledList;
      await this.settingsRepository.save(setting);
    } else {
      updatedEnabledList = enabledList.filter((_id) => _id !== id);
      setting.content = updatedEnabledList;
      await this.settingsRepository.save(setting);
    }

    this.communeStatusCacheService.refreshCache();

    return updatedEnabledList;
  }

  async computeAllCommuneStatuses(): Promise<
    Map<
      string,
      {
        disabled: boolean;
        mode?: SignalementSubmissionMode;
        filteredSources?: string[];
      }
    >
  > {
    const [
      allRevisions,
      communeSettingsList,
      moissonneurWhitelist,
      apiDepotClientWhitelist,
    ] = await Promise.all([
      this.apiDepotService.getAllCurrentRevisions(),
      this.settingsRepository.find({
        where: { name: Like('%-settings') },
      }),
      this.settingsRepository.findOne({
        where: { name: EnabledListKeys.SOURCES_MOISSONNEUR_ENABLED },
      }),
      this.settingsRepository.findOne({
        where: { name: EnabledListKeys.API_DEPOT_CLIENTS_ENABLED },
      }),
    ]);

    const communeSettingsMap = new Map<string, CommuneSettingsDTO>();
    for (const setting of communeSettingsList) {
      const codeCommune = setting.name.replace('-settings', '');
      communeSettingsMap.set(
        codeCommune,
        setting.content as CommuneSettingsDTO,
      );
    }

    const moissonneurWhitelistContent =
      (moissonneurWhitelist?.content as string[]) || [];
    const apiDepotClientWhitelistContent =
      (apiDepotClientWhitelist?.content as string[]) || [];

    const result = new Map<
      string,
      {
        disabled: boolean;
        mode?: SignalementSubmissionMode;
        filteredSources?: string[];
      }
    >();

    // Index revisions by codeCommune
    const revisionsByCommune = new Map<string, Revision>();
    for (const revision of allRevisions) {
      revisionsByCommune.set(revision.codeCommune, revision);
    }

    // Process all communes that have either a revision or custom settings
    const allCodeCommunes = new Set([
      ...revisionsByCommune.keys(),
      ...communeSettingsMap.keys(),
    ]);

    for (const codeCommune of allCodeCommunes) {
      const communeSettings = communeSettingsMap.get(codeCommune);

      // Settings override takes priority
      if (communeSettings) {
        if (communeSettings.disabled) {
          result.set(codeCommune, { disabled: true });
          continue;
        }
        result.set(codeCommune, {
          disabled: false,
          mode: communeSettings.mode || SignalementSubmissionMode.FULL,
          ...(communeSettings.filteredSources?.length && {
            filteredSources: communeSettings.filteredSources,
          }),
        });
        continue;
      }

      const revision = revisionsByCommune.get(codeCommune);

      if (!revision) {
        result.set(codeCommune, { disabled: true });
        continue;
      }

      // Published via mes-adresses
      if (
        revision.context?.extras?.balId &&
        ObjectIdRE.test(revision.context.extras.balId)
      ) {
        result.set(codeCommune, {
          disabled: false,
          mode: SignalementSubmissionMode.FULL,
        });
        continue;
      }

      // Published via moissonneur
      if (revision.context?.extras?.sourceId) {
        const isEnabled = moissonneurWhitelistContent.includes(
          revision.context.extras.sourceId,
        );
        result.set(codeCommune, {
          disabled: !isEnabled,
          ...(isEnabled && { mode: SignalementSubmissionMode.LIGHT }),
        });
        continue;
      }

      // Published via API depot client
      if (revision.client?.id) {
        const isEnabled = apiDepotClientWhitelistContent.includes(
          revision.client.id,
        );
        result.set(codeCommune, {
          disabled: !isEnabled,
          ...(isEnabled && { mode: SignalementSubmissionMode.LIGHT }),
        });
        continue;
      }

      result.set(codeCommune, { disabled: true });
    }

    return result;
  }
}
