import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData = require('form-data');

@Injectable()
export class DataGouvService {
  private readonly logger = new Logger(DataGouvService.name);

  constructor(private readonly configService: ConfigService) {}

  async uploadCSVResource(
    datasetId: string,
    resourceId: string,
    csvContent: string,
    fileName: string,
  ): Promise<void> {
    const apiKey = this.configService.get('DATAGOUV_API_KEY');
    const apiUrl =
      this.configService.get('DATAGOUV_API_URL') ||
      'https://www.data.gouv.fr/api/1';

    const form = new FormData();
    form.append('file', Buffer.from(csvContent, 'utf-8'), {
      filename: fileName,
      contentType: 'text/csv',
    });

    await axios.post(
      `${apiUrl}/datasets/${datasetId}/resources/${resourceId}/upload/`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'X-API-KEY': apiKey,
        },
      },
    );

    this.logger.log(
      `CSV uploaded to data.gouv.fr (dataset: ${datasetId}, resource: ${resourceId})`,
    );
  }
}
