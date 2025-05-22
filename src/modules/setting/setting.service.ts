import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Setting } from './setting.entity';
import { ApiDepotService } from '../api-depot/api-depot.service';
import { EnabledListKeys, SignalementSubmissionMode } from './setting.type';
import { CommuneSettingsDTO } from './dto/commune-settings.dto';
import { CommuneStatusDTO } from './dto/commune-status.dto';
import { SourceService } from '../source/source.service';
import { EnabledListDTO } from './dto/enabled-list.dto';

const ObjectIdRE = new RegExp('^[0-9a-fA-F]{24}$');

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
    private readonly apiDepotService: ApiDepotService,
    private readonly sourceService: SourceService,
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

    if (communesSettings?.disabled) {
      return {
        disabled: true,
        message:
          communesSettings.message ||
          'La commune a demandé la désactivation du dépôt de signalements depuis notre site. Nous vous recommandons de contacter directement la mairie.',
      };
    }

    if (communesSettings?.filteredSources?.includes(sourceId)) {
      return {
        disabled: true,
        message:
          'La commune a demandé la désactivation de la source depuis notre site. Nous vous recommandons de contacter directement la mairie.',
      };
    }

    // Then get current revision to know how commune is published
    const currentRevision =
      await this.apiDepotService.getCurrentRevision(codeCommune);

    // If the commune is not published, signalement is disabled
    if (!currentRevision) {
      return {
        disabled: true,
        message:
          "Les signalements ne peuvent pas être proposés sur cette commune car elle n'a pas publié sa Base Adresse Locale. Nous vous recommandons de contacter directement la mairie",
      };
    }

    // If commune is published via mes-adresses, signalement is enabled
    if (
      currentRevision?.context?.extras?.balId &&
      ObjectIdRE.test(currentRevision.context.extras.balId)
    ) {
      return {
        disabled: false,
        mode: communesSettings?.mode || SignalementSubmissionMode.FULL,
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
            'Cette commune ne gère pas encore la prise en compte des signalements depuis notre site. Nous vous recommandons de contacter directement la mairie',
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
            'Cette commune ne gère pas encore la prise en compte des signalements depuis notre site. Nous vous recommandons de contacter directement la mairie',
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

    return setting.content as CommuneSettingsDTO;
  }

  async isInEnabledList(key: EnabledListKeys, id: string): Promise<boolean> {
    const setting = await this.settingsRepository.findOne({
      where: { name: key },
    });

    if (!setting) {
      throw new Error(`Setting ${key} not found`);
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
      throw new Error(`Setting ${key} not found`);
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

    return updatedEnabledList;
  }
}
