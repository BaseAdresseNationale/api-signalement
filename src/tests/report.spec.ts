/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { SourceTypeEnum } from '../modules/source/source.types';
import { AlertTypeEnum } from '../modules/alert/alert.types';
import { SignalementTypeEnum } from '../modules/signalement/signalement.types';
import { MailerService } from '@nestjs-modules/mailer';
import { ReportModule } from '../modules/report/report.module';
import { AlertModule } from '../modules/alert/alert.module';
import { SignalementModule } from '../modules/signalement/signalement.module';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Repository } from 'typeorm';
import { Client as PGClient } from 'pg';
import { entities } from '../app.entities';
import { Alert } from '../modules/alert/alert.entity';
import { Signalement } from '../modules/signalement/signalement.entity';
import { Source } from '../modules/source/source.entity';
import { createRecording } from '../utils/test.utils';
import { ExistingLocationTypeEnum } from '../modules/signalement/schemas/existing-location.schema';
import { PositionTypeEnum } from '../modules/signalement/schemas/position.schema';
import { NumeroChangesRequestedDTO } from '../modules/signalement/dto/changes-requested.dto';
import { ApiDepotService } from '../modules/api-depot/api-depot.service';
import { ApiDepotModule } from '../modules/api-depot/api-depot.module';

const mockAPIDepotService = {
  getCurrentRevision: jest.fn().mockResolvedValue({
    context: {
      extras: { balId: '614b3385e1d1f2602d7ad284' },
    },
  }),
};
@Module({
  providers: [
    {
      provide: ApiDepotService,
      useValue: mockAPIDepotService,
    },
  ],
  exports: [ApiDepotService],
})
class MockedApiDepotModule {}

const mockMailerService = {
  sendMail: jest.fn(),
};

@Global()
@Module({
  providers: [
    {
      provide: MailerService,
      useValue: mockMailerService,
    },
  ],
  exports: [MailerService],
})
class MailerModule {}

describe('Report module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: PGClient;
  let alertRepository: Repository<Alert>;
  let signalementRepository: Repository<Signalement>;
  let sourceRepository: Repository<Source>;

  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer(
      'postgis/postgis:12-3.0',
    ).start();

    postgresClient = new PGClient({
      host: postgresContainer.getHost(),
      port: postgresContainer.getPort(),
      database: postgresContainer.getDatabase(),
      user: postgresContainer.getUsername(),
      password: postgresContainer.getPassword(),
    });

    await postgresClient.connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: postgresContainer.getHost(),
          port: postgresContainer.getPort(),
          username: postgresContainer.getUsername(),
          password: postgresContainer.getPassword(),
          database: postgresContainer.getDatabase(),
          synchronize: true,
          entities,
        }),
        MailerModule,
        AlertModule,
        SignalementModule,
        ReportModule,
      ],
    })
      .overrideModule(ApiDepotModule)
      .useModule(MockedApiDepotModule)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
      }),
    );
    await app.init();

    alertRepository = app.get(getRepositoryToken(Alert));
    signalementRepository = app.get(getRepositoryToken(Signalement));
    sourceRepository = app.get(getRepositoryToken(Source));
  });

  afterAll(async () => {
    await app?.close();
    await postgresClient?.end();
    await postgresContainer?.stop();
  });

  afterEach(async () => {
    await alertRepository.delete({});
    await signalementRepository.delete({});
    await sourceRepository.delete({});
  });

  const createAlert = async (
    source: Source,
    overrides?: Partial<{ codeCommune: string; comment: string }>,
  ): Promise<Alert> => {
    const alertEntity = new Alert({
      codeCommune: overrides?.codeCommune ?? '37003',
      type: AlertTypeEnum.MISSING_ADDRESS,
      point: {
        type: 'Point',
        coordinates: [0.982904, 47.410998],
      } as any,
      comment: overrides?.comment ?? 'Adresse manquante',
    });
    alertEntity.source = source;
    return createRecording(alertRepository, alertEntity);
  };

  const createSignalement = async (
    source: Source,
    overrides?: Partial<{ codeCommune: string }>,
  ): Promise<Signalement> => {
    const entity = new Signalement({
      codeCommune: overrides?.codeCommune ?? '37003',
      type: SignalementTypeEnum.LOCATION_TO_UPDATE,
      existingLocation: {
        type: ExistingLocationTypeEnum.NUMERO,
        numero: 2,
        suffixe: 'bis',
        position: {
          type: PositionTypeEnum.BATIMENT,
          point: {
            type: 'Point',
            coordinates: [0.982904, 47.410998],
          },
        },
        toponyme: {
          type: ExistingLocationTypeEnum.VOIE,
          nom: 'Rue de la Paix',
        },
      },
      changesRequested: {
        numero: 3,
        suffixe: 'ter',
        positions: [
          {
            type: PositionTypeEnum.BATIMENT,
            point: {
              type: 'Point',
              coordinates: [0.982904, 47.410998],
            },
          },
        ],
        parcelles: ['37003000BA0744'],
      } as NumeroChangesRequestedDTO,
    });
    entity.source = source;
    return createRecording(signalementRepository, entity);
  };

  describe('GET /reports', () => {
    it('should return both alerts and signalements by default', async () => {
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({ nom: 'Source test', type: SourceTypeEnum.PRIVATE }),
      );

      await createAlert(source);
      await createSignalement(source);

      const response = await request(app.getHttpServer())
        .get('/reports')
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);

      const kinds = response.body.data.map((r: any) => r.reportKind);
      expect(kinds).toContain('alert');
      expect(kinds).toContain('signalement');
    });

    it('should filter by AlertTypeEnum value', async () => {
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({ nom: 'Source test', type: SourceTypeEnum.PRIVATE }),
      );

      await createAlert(source);
      await createSignalement(source);

      const response = await request(app.getHttpServer())
        .get('/reports?types=MISSING_ADDRESS')
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].reportKind).toBe('alert');
    });

    it('should filter by SignalementTypeEnum value', async () => {
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({ nom: 'Source test', type: SourceTypeEnum.PRIVATE }),
      );

      await createAlert(source);
      await createSignalement(source);

      const response = await request(app.getHttpServer())
        .get('/reports?types=LOCATION_TO_UPDATE')
        .expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].reportKind).toBe('signalement');
    });

    it('should filter by multiple types across enums', async () => {
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({ nom: 'Source test', type: SourceTypeEnum.PRIVATE }),
      );

      await createAlert(source);
      await createSignalement(source);

      const response = await request(app.getHttpServer())
        .get('/reports?types=MISSING_ADDRESS&types=LOCATION_TO_UPDATE')
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.data).toHaveLength(2);
      const kinds = response.body.data.map((r: any) => r.reportKind);
      expect(kinds).toContain('alert');
      expect(kinds).toContain('signalement');
    });

    it('should filter by codeCommunes', async () => {
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({ nom: 'Source test', type: SourceTypeEnum.PRIVATE }),
      );

      await createAlert(source, { codeCommune: '37001' });
      await createAlert(source, { codeCommune: '37003' });
      await createSignalement(source, { codeCommune: '37003' });

      const response = await request(app.getHttpServer())
        .get('/reports?codeCommunes=37003')
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(
        response.body.data.every((r: any) => r.codeCommune === '37003'),
      ).toBe(true);
    });

    it('should paginate results', async () => {
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({ nom: 'Source test', type: SourceTypeEnum.PRIVATE }),
      );

      await createAlert(source, { comment: 'Alert 1' });
      await createAlert(source, { comment: 'Alert 2' });
      await createSignalement(source);

      const response = await request(app.getHttpServer())
        .get('/reports?limit=2&page=1')
        .expect(200);

      expect(response.body.total).toBe(3);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(2);

      const page2 = await request(app.getHttpServer())
        .get('/reports?limit=2&page=2')
        .expect(200);

      expect(page2.body.total).toBe(3);
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.page).toBe(2);
    });

    it('should return results sorted by createdAt DESC', async () => {
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({ nom: 'Source test', type: SourceTypeEnum.PRIVATE }),
      );

      await createAlert(source, { comment: 'First' });
      // Small delay to ensure different createdAt
      await new Promise((r) => setTimeout(r, 50));
      await createSignalement(source);
      await new Promise((r) => setTimeout(r, 50));
      await createAlert(source, { comment: 'Last' });

      const response = await request(app.getHttpServer())
        .get('/reports')
        .expect(200);

      const dates = response.body.data.map((r: any) =>
        new Date(r.createdAt).getTime(),
      );
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('should return empty results when no data', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports')
        .expect(200);

      expect(response.body).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
    });
  });
});
