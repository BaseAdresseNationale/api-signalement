import { Test, TestingModule } from '@nestjs/testing';
import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { SourceTypeEnum } from '../modules/source/source.types';
import { AlertStatusEnum, AlertTypeEnum } from '../modules/alert/alert.types';
import { CreateAlertDTO, UpdateAlertDTO } from '../modules/alert/alert.dto';
import { MissingAddressContext } from '../modules/alert/schemas/alert-context.schema';
import { MailerService } from '@nestjs-modules/mailer';
import { AlertModule } from '../modules/alert/alert.module';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Repository } from 'typeorm';
import { Client as PGClient } from 'pg';
import { entities } from '../app.entities';
import { Alert } from '../modules/alert/alert.entity';
import { Source } from '../modules/source/source.entity';
import { Client } from '../modules/client/client.entity';
import { createRecording } from '../utils/test.utils';
import { v4 } from 'uuid';
import { getCommune } from '../utils/cog.utils';
import { Setting } from '../modules/setting/setting.entity';
import { ApiDepotService } from '../modules/api-depot/api-depot.service';
import { ApiDepotModule } from '../modules/api-depot/api-depot.module';

const getSerializedAlert = (
  alert: Alert,
  source: Source,
  client?: Client,
  withAuthor?: boolean,
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { codeCommune, author, createdAt, updatedAt, ...rest } = alert;
  return {
    ...rest,
    codeCommune,
    nomCommune: getCommune(codeCommune)?.nom,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt:
      updatedAt instanceof Date ? new Date(updatedAt).toISOString() : updatedAt,
    source: {
      ...source,
      createdAt: new Date(source.createdAt).toISOString(),
      updatedAt: new Date(source.updatedAt).toISOString(),
    },
    ...(client
      ? {
          processedBy: {
            ...client,
            createdAt: new Date(client.createdAt).toISOString(),
            updatedAt: new Date(client.updatedAt).toISOString(),
          },
        }
      : {
          processedBy: null,
        }),
    ...(withAuthor ? { author } : {}),
  };
};

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

describe('Alert module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: PGClient;
  let alertRepository: Repository<Alert>;
  let clientRepository: Repository<Client>;
  let sourceRepository: Repository<Source>;
  let settingRepository: Repository<Setting>;

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

    // INIT MODEL
    alertRepository = app.get(getRepositoryToken(Alert));
    sourceRepository = app.get(getRepositoryToken(Source));
    clientRepository = app.get(getRepositoryToken(Client));
    settingRepository = app.get(getRepositoryToken(Setting));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await alertRepository.delete({});
    await sourceRepository.delete({});
    await clientRepository.delete({});
    await settingRepository.delete({});
    mockMailerService.sendMail.mockClear();
  });

  // Helper to create an alert entity attached to a source
  const createAlertEntity = (
    source: Source,
    overrides?: Partial<{
      codeCommune: string;
      type: AlertTypeEnum;
      comment: string;
      author: { email?: string; firstName?: string; lastName?: string };
      status: AlertStatusEnum;
      context: MissingAddressContext;
    }>,
  ): Alert => {
    const alertEntity = new Alert({
      codeCommune: overrides?.codeCommune ?? '37003',
      type: overrides?.type ?? AlertTypeEnum.MISSING_ADDRESS,
      point: {
        type: 'Point',
        coordinates: [0.982904, 47.410998],
      } as any,
      comment: overrides?.comment ?? 'Adresse manquante sur la rue principale',
      author: overrides?.author,
      context: overrides?.context,
    });
    alertEntity.source = source;
    if (overrides?.status) {
      alertEntity.status = overrides.status;
    }
    return alertEntity;
  };

  describe('GET /alerts', () => {
    it('should get paginated alerts', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const alert1 = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          codeCommune: '37003',
          type: AlertTypeEnum.MISSING_ADDRESS,
          comment: 'Adresse manquante 1',
          author: { email: 'test@test.com' },
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/alerts')
        .expect(200);

      const data = [alert1].map((alert) => getSerializedAlert(alert, source));

      expect(response.body).toEqual({
        data,
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('should get alerts by commune', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      await createRecording(
        alertRepository,
        createAlertEntity(source, {
          codeCommune: '37001',
          comment: 'Alert commune 37001',
        }),
      );

      const alert2 = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          codeCommune: '37003',
          comment: 'Alert commune 37003 - 1',
        }),
      );

      const alert3 = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          codeCommune: '37003',
          comment: 'Alert commune 37003 - 2',
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/alerts?codeCommunes=37003')
        .expect(200);

      const data = [alert3, alert2].map((alert) =>
        getSerializedAlert(alert, source),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 20,
      });
    });

    it('should get alerts by source', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: token1, ...source1 } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: token2, ...source2 } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      await createRecording(
        alertRepository,
        createAlertEntity(source1, { comment: 'Alert source 1' }),
      );

      const alert2 = await createRecording(
        alertRepository,
        createAlertEntity(source2, { comment: 'Alert source 2 - 1' }),
      );

      const alert3 = await createRecording(
        alertRepository,
        createAlertEntity(source2, { comment: 'Alert source 2 - 2' }),
      );

      const response = await request(app.getHttpServer())
        .get('/alerts?sourceIds=' + source2.id)
        .expect(200);

      const data = [alert3, alert2].map((alert) =>
        getSerializedAlert(alert, source2),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 20,
      });
    });

    it('should get alerts by status', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      await createRecording(
        alertRepository,
        createAlertEntity(source, { comment: 'Pending alert' }),
      );

      const alert2 = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          comment: 'Processed alert 1',
          status: AlertStatusEnum.PROCESSED,
        }),
      );

      const alert3 = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          comment: 'Processed alert 2',
          status: AlertStatusEnum.PROCESSED,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/alerts?status=' + AlertStatusEnum.PROCESSED)
        .expect(200);

      const data = [alert3, alert2].map((alert) =>
        getSerializedAlert(alert, source),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 20,
      });
    });

    it('should get alerts by type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const alert1 = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          type: AlertTypeEnum.MISSING_ADDRESS,
          comment: 'Missing address',
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/alerts?types=' + AlertTypeEnum.MISSING_ADDRESS)
        .expect(200);

      const data = [alert1].map((alert) => getSerializedAlert(alert, source));

      expect(response.body).toEqual({
        data,
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('GET /alerts/:idAlert', () => {
    it('should get an alert by id (with author infos)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const { token: clientToken } = await createRecording(
        clientRepository,
        new Client({
          nom: 'Mes adresses',
        }),
      );

      const alert = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          author: {
            email: 'test@test.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          comment: 'Adresse manquante',
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/alerts/' + alert.id)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedAlert(alert, source, null, true),
      );
    });

    it('should get an alert by id (without author infos)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const alert = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          author: {
            email: 'test@test.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          comment: 'Adresse manquante',
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/alerts/' + alert.id)
        .expect(200);

      expect(response.body).toEqual(getSerializedAlert(alert, source));
    });

    it('should throw 404 if not found', async () => {
      const alertId = v4();

      await request(app.getHttpServer()).get(`/alerts/${alertId}`).expect(404);
    });
  });

  describe('POST /alerts', () => {
    it('should throw 401 if invalid authorization', async () => {
      const createAlertDTO: CreateAlertDTO = {
        codeCommune: '37001',
        type: AlertTypeEnum.MISSING_ADDRESS,
        point: {
          type: 'Point' as any,
          coordinates: [0.982904, 47.410998],
        },
        comment: 'Adresse manquante',
      };

      await request(app.getHttpServer())
        .post('/alerts')
        .send(createAlertDTO)
        .set('Authorization', `Bearer invalid_token`)
        .expect(401);
    });

    it('should create an alert of type MISSING_ADDRESS', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const createAlertDTO: CreateAlertDTO = {
        codeCommune: '37001',
        type: AlertTypeEnum.MISSING_ADDRESS,
        point: {
          type: 'Point' as any,
          coordinates: [0.982904, 47.410998],
        },
        comment: 'Adresse manquante sur la rue principale',
      };

      const response = await request(app.getHttpServer())
        .post(`/alerts?sourceId=${privateSource.id}`)
        .send(createAlertDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createAlertDTO,
        nomCommune: getCommune(createAlertDTO.codeCommune)?.nom,
        id: expect.any(String),
        point: {
          coordinates: expect.any(Array),
          type: 'Point',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        context: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: AlertStatusEnum.PENDING,
      });
    });

    it('should create an alert with author', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const createAlertDTO: CreateAlertDTO = {
        codeCommune: '37001',
        type: AlertTypeEnum.MISSING_ADDRESS,
        point: {
          type: 'Point' as any,
          coordinates: [0.982904, 47.410998],
        },
        comment: 'Adresse manquante',
        author: {
          email: 'test@test.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/alerts?sourceId=${privateSource.id}`)
        .send(createAlertDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { author, ...createAlertDTOWithoutAuthor } = createAlertDTO;
      expect(response.body).toEqual({
        ...createAlertDTOWithoutAuthor,
        nomCommune: getCommune(createAlertDTO.codeCommune)?.nom,
        id: expect.any(String),
        point: {
          coordinates: expect.any(Array),
          type: 'Point',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        context: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: AlertStatusEnum.PENDING,
      });

      // Author should not be returned in the response (select: false)
      expect(response.body.author).toBeUndefined();
    });

    it('should create an alert with context', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const createAlertDTO: CreateAlertDTO = {
        codeCommune: '37001',
        type: AlertTypeEnum.MISSING_ADDRESS,
        point: {
          type: 'Point' as any,
          coordinates: [0.982904, 47.410998],
        },
        comment: 'Adresse manquante avec contexte RNB',
        context: {
          idRNB: 'RNB-12345',
          createdAddress: {
            type: 'NUMERO' as any,
            numero: 10,
            suffixe: 'bis',
            position: {
              type: 'BATIMENT' as any,
              point: {
                type: 'Point' as any,
                coordinates: [0.982904, 47.410998],
              },
            },
            toponyme: {
              type: 'VOIE' as any,
              nom: 'Rue de la Paix',
            },
          } as any,
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/alerts?sourceId=${privateSource.id}`)
        .send(createAlertDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createAlertDTO,
        nomCommune: getCommune(createAlertDTO.codeCommune)?.nom,
        id: expect.any(String),
        point: {
          coordinates: expect.any(Array),
          type: 'Point',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: AlertStatusEnum.PENDING,
      });

      expect(response.body.context).toEqual({
        idRNB: 'RNB-12345',
        createdAddress: createAlertDTO.context.createdAddress,
      });
    });

    it('should return a 405 error if the commune is disabled', async () => {
      await createRecording(
        settingRepository,
        new Setting({
          name: `37001-settings`,
          content: {
            disabled: true,
          },
        }),
      );

      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const createAlertDTO: CreateAlertDTO = {
        codeCommune: '37001',
        type: AlertTypeEnum.MISSING_ADDRESS,
        point: {
          type: 'Point' as any,
          coordinates: [0.982904, 47.410998],
        },
        comment: 'Adresse manquante',
      };

      await request(app.getHttpServer())
        .post(`/alerts?sourceId=${privateSource.id}`)
        .send(createAlertDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(405);
    });
  });

  describe('PUT /alerts/:idAlert', () => {
    it('should throw 401 if invalid authorization', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const alert = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          author: { email: 'test@test.com' },
          comment: 'Adresse manquante',
        }),
      );

      const updateAlertDTO: UpdateAlertDTO = {
        status: AlertStatusEnum.PROCESSED,
      };

      await request(app.getHttpServer())
        .put('/alerts/' + alert.id)
        .send(updateAlertDTO)
        .set('Authorization', `Bearer invalid_token`)
        .expect(401);
    });

    it('should update an alert with email notification', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: sourceToken, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const { token: clientToken, ...client } = await createRecording(
        clientRepository,
        new Client({
          nom: 'Mes adresses',
        }),
      );

      const alert = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          author: { email: 'test@test.com' },
          comment: 'Adresse manquante',
        }),
      );

      const updateAlertDTO: UpdateAlertDTO = {
        status: AlertStatusEnum.PROCESSED,
      };

      const response = await request(app.getHttpServer())
        .put('/alerts/' + alert.id)
        .send(updateAlertDTO)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedAlert(
          {
            ...alert,
            ...updateAlertDTO,
            updatedAt: expect.any(String),
          },
          source,
          client,
        ),
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        context: {
          date: expect.any(String),
          commune: getCommune('37003')?.nom,
        },
        to: 'test@test.com',
        subject: 'Votre signalement a bien été pris en compte',
        template: 'processed',
      });
    });

    it('should update an alert without email notification', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: sourceToken, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: clientToken, ...client } = await createRecording(
        clientRepository,
        new Client({
          nom: 'Mes adresses',
        }),
      );

      const alert = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          comment: 'Adresse manquante',
        }),
      );

      const updateAlertDTO: UpdateAlertDTO = {
        status: AlertStatusEnum.PROCESSED,
      };

      const response = await request(app.getHttpServer())
        .put('/alerts/' + alert.id)
        .send(updateAlertDTO)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedAlert(
          {
            ...alert,
            ...updateAlertDTO,
            updatedAt: expect.any(String),
          },
          source,
          client,
        ),
      );

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should update an alert with IGNORED status and email notification', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: sourceToken, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: clientToken, ...client } = await createRecording(
        clientRepository,
        new Client({
          nom: 'Mes adresses',
        }),
      );

      const alert = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          author: { email: 'test@test.com' },
          comment: 'Adresse manquante',
        }),
      );

      const updateAlertDTO: UpdateAlertDTO = {
        status: AlertStatusEnum.IGNORED,
      };

      const response = await request(app.getHttpServer())
        .put('/alerts/' + alert.id)
        .send(updateAlertDTO)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedAlert(
          {
            ...alert,
            ...updateAlertDTO,
            updatedAt: expect.any(String),
          },
          source,
          client,
        ),
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        context: {
          date: expect.any(String),
          commune: getCommune('37003')?.nom,
        },
        to: 'test@test.com',
        subject: "Votre signalement n'a pas été pris en compte",
        template: 'ignored',
      });
    });

    it('should throw 400 if alert is already processed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: sourceToken, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const { token: clientToken } = await createRecording(
        clientRepository,
        new Client({
          nom: 'Mes adresses',
        }),
      );

      const alert = await createRecording(
        alertRepository,
        createAlertEntity(source, {
          comment: 'Adresse manquante',
          status: AlertStatusEnum.PROCESSED,
        }),
      );

      const updateAlertDTO: UpdateAlertDTO = {
        status: AlertStatusEnum.IGNORED,
      };

      await request(app.getHttpServer())
        .put('/alerts/' + alert.id)
        .send(updateAlertDTO)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(400);
    });
  });
});
