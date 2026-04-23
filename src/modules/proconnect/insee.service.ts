import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OrganizationInfo {
  nom: string;
  isPublic: boolean;
  isCommune: boolean;
  codeCommune: string | null;
}

@Injectable()
export class InseeService {
  private readonly logger = new Logger(InseeService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('INSEE_API_URL');
    this.apiKey = this.configService.get<string>('INSEE_API_KEY_INTEGRATION');
  }

  async getOrganizationInfo(siret: string): Promise<OrganizationInfo | null> {
    if (!this.apiKey || !this.apiUrl) {
      this.logger.warn(
        'INSEE API configuration is missing. Skipping organization info retrieval.',
      );
      return null;
    }

    try {
      const response = await fetch(`${this.apiUrl}/siret/${siret}`, {
        headers: {
          'X-INSEE-Api-Key-Integration': this.apiKey,
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
      // Catégorie juridique 7210 = Commune et commune nouvelle (mairie)
      const isCommune = categorieJuridique === '7210';
      const codeCommune =
        etablissement?.adresseEtablissement?.codeCommuneEtablissement || null;

      return { nom, isPublic, isCommune, codeCommune };
    } catch (error) {
      this.logger.error(
        `Error fetching organization info for SIRET ${siret}: ${error.message}`,
      );
      return null;
    }
  }
}
