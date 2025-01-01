import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  OpenAPI as OpenAPIMesAdressesAPI,
  BasesLocalesService,
} from '../../openapi/mes-adresses-api';

@Injectable()
export class MesAdressesAPIService {
  constructor(private configService: ConfigService) {
    OpenAPIMesAdressesAPI.BASE = this.configService.get('MES_ADRESSES_API_URL');
    OpenAPIMesAdressesAPI.TOKEN = this.configService.get(
      'MES_ADRESSES_API_TOKEN',
    );
  }

  searchBaseLocale(
    ...params: Parameters<typeof BasesLocalesService.searchBaseLocale>
  ) {
    return BasesLocalesService.searchBaseLocale(...params);
  }

  getBaseLocale(
    ...params: Parameters<typeof BasesLocalesService.findBaseLocale>
  ) {
    return BasesLocalesService.findBaseLocale(...params);
  }
}
