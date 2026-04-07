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
import { CommuneSettingsCacheService } from './commune-settings-cache.service';

const ObjectIdRE = new RegExp('^[0-9a-fA-F]{24}$');

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
    private readonly apiDepotService: ApiDepotService,
    private readonly sourceService: SourceService,
    private readonly communeSettingsCacheService: CommuneSettingsCacheService,
  ) {}

  getCommuneSettingsKey(codeCommune: string): string {
    return `${codeCommune}-settings`;
  }

  private determineCommuneStatus(
    communeSettings: CommuneSettingsDTO | null,
    revision: Revision | null,
    moissonneurWhitelistContent: string[],
    apiDepotClientWhitelistContent: string[],
  ): {
    disabled: boolean;
    mode?: SignalementSubmissionMode;
    filteredSources?: string[];
  } {
    // Settings override takes priority
    if (communeSettings) {
      if (communeSettings.disabled) {
        return { disabled: true };
      }
      return {
        disabled: false,
        mode: communeSettings.mode || SignalementSubmissionMode.FULL,
        ...(communeSettings.filteredSources?.length && {
          filteredSources: communeSettings.filteredSources,
        }),
      };
    }

    if (!revision) {
      return { disabled: true };
    }

    // Published via mes-adresses
    if (
      revision.context?.extras?.balId &&
      ObjectIdRE.test(revision.context.extras.balId)
    ) {
      return {
        disabled: false,
        mode: SignalementSubmissionMode.FULL,
      };
    }

    // Published via moissonneur
    if (revision.context?.extras?.sourceId) {
      const isEnabled = moissonneurWhitelistContent.includes(
        revision.context.extras.sourceId,
      );
      return {
        disabled: !isEnabled,
        ...(isEnabled && { mode: SignalementSubmissionMode.LIGHT }),
      };
    }

    // Published via API depot client
    if (revision.client?.id) {
      const isEnabled = apiDepotClientWhitelistContent.includes(
        revision.client.id,
      );
      return {
        disabled: !isEnabled,
        ...(isEnabled && { mode: SignalementSubmissionMode.LIGHT }),
      };
    }

    return { disabled: true };
  }

  async getCommuneStatus(
    codeCommune: string,
    sourceId: string,
  ): Promise<CommuneStatusDTO> {
    // Check source id
    await this.sourceService.findOneOrFail(sourceId);

    const [
      setting,
      currentRevision,
      moissonneurWhitelist,
      apiDepotClientWhitelist,
    ] = await Promise.all([
      this.settingsRepository.findOne({
        where: { name: this.getCommuneSettingsKey(codeCommune) },
      }),
      this.apiDepotService.getCurrentRevision(codeCommune),
      this.settingsRepository.findOne({
        where: { name: EnabledListKeys.SOURCES_MOISSONNEUR_ENABLED },
      }),
      this.settingsRepository.findOne({
        where: { name: EnabledListKeys.API_DEPOT_CLIENTS_ENABLED },
      }),
    ]);

    const communeSettings = (setting?.content as CommuneSettingsDTO) || null;
    const moissonneurWhitelistContent =
      (moissonneurWhitelist?.content as string[]) || [];
    const apiDepotClientWhitelistContent =
      (apiDepotClientWhitelist?.content as string[]) || [];

    const status = this.determineCommuneStatus(
      communeSettings,
      currentRevision,
      moissonneurWhitelistContent,
      apiDepotClientWhitelistContent,
    );

    // Handle sourceId-specific filtering
    if (!status.disabled && status.filteredSources?.includes(sourceId)) {
      return {
        disabled: true,
        message:
          communeSettings?.message ||
          'La commune a demandé la désactivation de cette source de signalements. Nous vous recommandons de contacter directement la mairie.',
      };
    }

    if (status.disabled) {
      let message: string | undefined;
      if (communeSettings?.disabled) {
        message =
          communeSettings.message ||
          'La commune a demandé la désactivation du dépôt de signalements. Nous vous recommandons de contacter directement la mairie.';
      } else if (!currentRevision) {
        message =
          "Les signalements ne peuvent pas être proposés sur cette commune car elle n'a pas publié sa Base Adresse Locale. Nous vous recommandons de contacter directement la mairie.";
      } else {
        message =
          'Cette commune ne gère pas encore la prise en compte des signalements depuis notre site. Nous vous recommandons de contacter directement la mairie.';
      }
      return { disabled: true, message };
    }

    return {
      disabled: false,
      mode: status.mode,
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

    this.communeSettingsCacheService.refreshCache();

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

    this.communeSettingsCacheService.refreshCache();

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
      const communeSettings = communeSettingsMap.get(codeCommune) || null;
      const revision = revisionsByCommune.get(codeCommune) || null;

      result.set(
        codeCommune,
        this.determineCommuneStatus(
          communeSettings,
          revision,
          moissonneurWhitelistContent,
          apiDepotClientWhitelistContent,
        ),
      );
    }

    return result;
  }
}
