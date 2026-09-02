import { Test, TestingModule } from '@nestjs/testing';
import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { MailerService } from '@nestjs-modules/mailer';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Repository } from 'typeorm';
import { Client as PGClient } from 'pg';
import { entities } from '../app.entities';
import { StatsModule } from '../modules/stats/stats.module';
import { Signalement } from '../modules/signalement/signalement.entity';
import { Alert } from '../modules/alert/alert.entity';
import { Source } from '../modules/source/source.entity';
import { Client } from '../modules/client/client.entity';
import { SourceTypeEnum } from '../modules/source/source.types';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from '../modules/signalement/signalement.types';
import { ExistingLocationTypeEnum } from '../modules/signalement/schemas/existing-location.schema';
import { PositionTypeEnum } from '../modules/signalement/schemas/position.schema';
import { AlertStatusEnum, AlertTypeEnum } from '../modules/alert/alert.types';
import { createRecording } from '../utils/test.utils';
import { ApiDepotService } from '../modules/api-depot/api-depot.service';
import { ApiDepotModule } from '../modules/api-depot/api-depot.module';

const mockAPIDepotService = {
  getCurrentRevision: jest.fn().mockResolvedValue({
    context: {
      extras: { balId: '614b3385e1d1f2602d7ad284' },
    },
  }),
  getAllCurrentRevisions: jest.fn().mockResolvedValue([]),
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

describe('Stats module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: PGClient;
  let signalementRepository: Repository<Signalement>;
  let alertRepository: Repository<Alert>;
  let sourceRepository: Repository<Source>;
  let clientRepository: Repository<Client>;

  // Mois courant au format 'YYYY-MM', clé utilisée par byMonth
  const currentMonth = new Date().toISOString().slice(0, 7);

  const createSignalementEntity = (
    source: Source,
    overrides?: { status?: SignalementStatusEnum; processedBy?: Client },
  ): Signalement => {
    const signalement = new Signalement({
      codeCommune: '37003',
      type: SignalementTypeEnum.LOCATION_TO_DELETE,
      existingLocation: {
        type: ExistingLocationTypeEnum.NUMERO,
        numero: 12,
        suffixe: null,
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
        comment: 'à supprimer car doublon',
      },
    });
    signalement.source = source;
    if (overrides?.status) {
      signalement.status = overrides.status;
    }
    if (overrides?.processedBy) {
      signalement.processedBy = overrides.processedBy;
    }
    return signalement;
  };

  const createAlertEntity = (
    source: Source,
    overrides?: { status?: AlertStatusEnum; processedBy?: Client },
  ): Alert => {
    const alert = new Alert({
      codeCommune: '37003',
      type: AlertTypeEnum.MISSING_ADDRESS,
      point: {
        type: 'Point',
        coordinates: [0.982904, 47.410998],
      } as any,
      comment: 'Adresse manquante',
    });
    alert.source = source;
    if (overrides?.status) {
      alert.status = overrides.status;
    }
    if (overrides?.processedBy) {
      alert.processedBy = overrides.processedBy;
    }
    return alert;
  };

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
        StatsModule,
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

    signalementRepository = app.get(getRepositoryToken(Signalement));
    alertRepository = app.get(getRepositoryToken(Alert));
    sourceRepository = app.get(getRepositoryToken(Source));
    clientRepository = app.get(getRepositoryToken(Client));
  });

  afterAll(async () => {
    await app?.close();
    await postgresClient?.end();
    await postgresContainer?.stop();
  });

  afterEach(async () => {
    await signalementRepository.delete({});
    await alertRepository.delete({});
    await sourceRepository.delete({});
    await clientRepository.delete({});
  });

  describe('GET /stats', () => {
    it('should return empty stats when there is no report', async () => {
      const response = await request(app.getHttpServer())
        .get('/stats')
        .expect(200);

      expect(response.body).toEqual({
        signalementStats: {
          total: 0,
          fromSources: {},
          processedBy: {},
          byMonth: [],
        },
        alertStats: {
          total: 0,
          fromSources: {},
          processedBy: {},
          byMonth: [],
        },
      });
    });

    it('should aggregate stats grouped by source, client and status', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: clientToken, ...client } = await createRecording(
        clientRepository,
        new Client({
          nom: 'Mes adresses',
        }),
      );

      // 2 signalements en attente + 1 traité
      await createRecording(
        signalementRepository,
        createSignalementEntity(source),
      );
      await createRecording(
        signalementRepository,
        createSignalementEntity(source),
      );
      await createRecording(
        signalementRepository,
        createSignalementEntity(source, {
          status: SignalementStatusEnum.PROCESSED,
          processedBy: client as Client,
        }),
      );

      // 1 alerte en attente + 1 traitée
      await createRecording(alertRepository, createAlertEntity(source));
      await createRecording(
        alertRepository,
        createAlertEntity(source, {
          status: AlertStatusEnum.PROCESSED,
          processedBy: client as Client,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/stats')
        .expect(200);

      expect(response.body.signalementStats).toEqual({
        total: 3,
        fromSources: {
          'SIG Ville': {
            [SignalementStatusEnum.PENDING]: 2,
            [SignalementStatusEnum.PROCESSED]: 1,
          },
        },
        processedBy: {
          'Mes adresses': {
            [SignalementStatusEnum.PROCESSED]: 1,
          },
        },
        byMonth: [
          { date: currentMonth, type: 'created', count: 3 },
          { date: currentMonth, type: 'processed', count: 1 },
        ],
      });

      expect(response.body.alertStats).toEqual({
        total: 2,
        fromSources: {
          'SIG Ville': {
            [AlertStatusEnum.PENDING]: 1,
            [AlertStatusEnum.PROCESSED]: 1,
          },
        },
        processedBy: {
          'Mes adresses': {
            [AlertStatusEnum.PROCESSED]: 1,
          },
        },
        byMonth: [
          { date: currentMonth, type: 'created', count: 2 },
          { date: currentMonth, type: 'processed', count: 1 },
        ],
      });
    });

    it('should fill missing months with zero counts between the oldest and newest month', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: clientToken, ...client } = await createRecording(
        clientRepository,
        new Client({
          nom: 'Mes adresses',
        }),
      );

      const pending1 = await createRecording(
        signalementRepository,
        createSignalementEntity(source),
      );
      const pending2 = await createRecording(
        signalementRepository,
        createSignalementEntity(source),
      );
      const processed = await createRecording(
        signalementRepository,
        createSignalementEntity(source, {
          status: SignalementStatusEnum.PROCESSED,
          processedBy: client as Client,
        }),
      );

      // Backdate en SQL brut pour ne pas déclencher l'auto-update de updated_at :
      // 3 créations en janvier, 1 traitement en avril -> trous en février/mars.
      await signalementRepository.query(
        'UPDATE reports SET created_at = $1, updated_at = $1 WHERE id = $2',
        ['2026-01-15T00:00:00Z', pending1.id],
      );
      await signalementRepository.query(
        'UPDATE reports SET created_at = $1, updated_at = $1 WHERE id = $2',
        ['2026-01-20T00:00:00Z', pending2.id],
      );
      await signalementRepository.query(
        'UPDATE reports SET created_at = $1, updated_at = $2 WHERE id = $3',
        ['2026-01-25T00:00:00Z', '2026-04-10T00:00:00Z', processed.id],
      );

      const response = await request(app.getHttpServer())
        .get('/stats')
        .expect(200);

      expect(response.body.signalementStats.byMonth).toEqual([
        { date: '2026-01', type: 'created', count: 3 },
        { date: '2026-01', type: 'processed', count: 0 },
        { date: '2026-02', type: 'created', count: 0 },
        { date: '2026-02', type: 'processed', count: 0 },
        { date: '2026-03', type: 'created', count: 0 },
        { date: '2026-03', type: 'processed', count: 0 },
        { date: '2026-04', type: 'created', count: 0 },
        { date: '2026-04', type: 'processed', count: 1 },
      ]);
    });
  });
});
