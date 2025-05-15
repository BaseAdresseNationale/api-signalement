import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Setting } from './setting.entity';

export const COMMUNES_DISABLED_KEY = 'communes-disabled';

@Injectable()
export class SettingService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  async isCommuneDisabled(codeCommune: string): Promise<boolean> {
    const setting = await this.settingsRepository.findOne({
      where: { name: COMMUNES_DISABLED_KEY },
    });

    if (!setting) {
      throw new Error(`Setting ${COMMUNES_DISABLED_KEY} not found`);
    }

    const communesDisabled = setting.content as string[];

    return communesDisabled.includes(codeCommune);
  }

  async updateCommunesDisabled(codeCommune: string): Promise<void> {
    const setting = await this.settingsRepository.findOne({
      where: { name: COMMUNES_DISABLED_KEY },
    });

    if (!setting) {
      throw new Error(`Setting ${COMMUNES_DISABLED_KEY} not found`);
    }

    const communesDisabled = setting.content as string[];

    if (!communesDisabled.includes(codeCommune)) {
      communesDisabled.push(codeCommune);
      setting.content = communesDisabled;
      await this.settingsRepository.save(setting);
    } else {
      const updatedCommunesDisabled = communesDisabled.filter(
        (commune) => commune !== codeCommune,
      );
      setting.content = updatedCommunesDisabled;
      await this.settingsRepository.save(setting);
    }
  }
}
