import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { of, catchError, firstValueFrom } from 'rxjs';

import { Revision } from './api-depot.types';

@Injectable()
export class ApiDepotService {
  constructor(private readonly httpService: HttpService) {}

  public async getCurrentRevision(codeCommune: string): Promise<Revision> {
    const { data: revision } = await firstValueFrom(
      await this.httpService
        .get<Revision>(`/communes/${codeCommune}/current-revision`)
        .pipe(
          catchError((error: AxiosError) => {
            if (error.response && error.response.status === 404) {
              return of({ data: null });
            }
            throw error;
          }),
        ),
    );

    return revision;
  }
}
