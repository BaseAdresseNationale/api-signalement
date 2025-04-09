import { Injectable } from '@nestjs/common';
import * as communes from '@etalab/decoupage-administratif/data/communes.json';
import { CommuneCOG } from './cog.types';

@Injectable()
export class COGService {
  private communeMap: Record<string, any> = {};
  constructor() {
    this.communeMap = (communes as Array<CommuneCOG>).reduce((acc, commune) => {
      acc[commune.code] = commune;
      return acc;
    }, {});
  }

  getCommuneByCode(code: string): CommuneCOG {
    const commune = this.communeMap[code];
    if (!commune) {
      throw new Error(`Commune with code ${code} not found`);
    }

    return commune;
  }
}
