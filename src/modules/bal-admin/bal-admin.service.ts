import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

@Injectable()
export class BalAdminService {
  private readonly logger = new Logger(BalAdminService.name);
  private readonly perimeterCache = new Map<
    string,
    { communes: string[]; expiresAt: number }
  >();

  constructor(private readonly configService: ConfigService) {}

  // Retourne la liste des codes commune couverts par le périmètre du partenaire.
  // Résultat mis en cache 1h pour éviter de re-requêter BAL-admin lors d'un
  // traitement de signalements en masse.
  async getPartenairePerimeters(partenaireId: string): Promise<string[]> {
    const cached = this.perimeterCache.get(partenaireId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.communes;
    }

    const apiUrl = this.configService.get<string>('BAL_ADMIN_API_URL');
    const apiToken = this.configService.get<string>('BAL_ADMIN_API_TOKEN');

    const { data } = await axios.get<string[]>(
      `${apiUrl}/partenaires-de-la-charte/${partenaireId}/perimeters`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );

    const communes = data ?? [];
    this.perimeterCache.set(partenaireId, {
      communes,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return communes;
  }
}
