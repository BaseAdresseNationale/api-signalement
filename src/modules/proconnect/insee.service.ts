import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OrganizationInfo {
  nom: string;
  isPublic: boolean;
}

@Injectable()
export class InseeService {
  private readonly logger = new Logger(InseeService.name);

  constructor(private readonly configService: ConfigService) {}

  async getOrganizationInfo(siret: string): Promise<OrganizationInfo | null> {
    const apiUrl = this.configService.get<string>('INSEE_API_URL');
    const apiKey = this.configService.get<string>('INSEE_API_KEY_INTEGRATION');

    if (!apiKey || !apiUrl) {
      return null;
    }

    try {
      const response = await fetch(`${apiUrl}/siret/${siret}`, {
        headers: {
          'X-INSEE-Api-Key-Integration': apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const etablissement = data.etablissement;
      const uniteLegale = etablissement?.uniteLegale;

      let nom: string | null = null;

      if (uniteLegale?.denominationUniteLegale) {
        nom = uniteLegale.denominationUniteLegale;
      } else if (uniteLegale?.nomUniteLegale) {
        nom =
          `${uniteLegale.prenomUsuelUniteLegale || ''} ${uniteLegale.nomUniteLegale}`.trim();
      }

      if (!nom) {
        return null;
      }

      const categorieJuridique =
        uniteLegale?.categorieJuridiqueUniteLegale || '';
      const isPublic = categorieJuridique.startsWith('7');

      return { nom, isPublic };
    } catch (error) {
      this.logger.error(
        `Error fetching organization info for SIRET ${siret}: ${error.message}`,
      );
      return null;
    }
  }
}
