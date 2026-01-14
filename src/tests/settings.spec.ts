import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Source } from '../modules/source/source.entity';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client as PGClient } from 'pg';
import { Setting } from '../modules/setting/setting.entity';
import { createRecording } from '../utils/test.utils';
import { SourceTypeEnum } from '../modules/source/source.types';
import { Repository } from 'typeorm';
import { ApiDepotService } from '../modules/api-depot/api-depot.service';
import { ApiDepotModule } from '../modules/api-depot/api-depot.module';
import { entities } from '../app.entities';
import { SettingModule } from '../modules/setting/setting.module';
import {
  EnabledListKeys,
  SignalementSubmissionMode,
} from '../modules/setting/setting.type';

const currentRevisionMock = jest.fn();

const testSource = new Source({
  nom: 'SIG Ville',
  type: SourceTypeEnum.PRIVATE,
});

@Module({
  providers: [
    {
      provide: ApiDepotService,
      useValue: {
        getCurrentRevision: currentRevisionMock,
      },
    },
  ],
  exports: [ApiDepotService],
})
class MockedApiDepotModule {}

const testObjectId = '614b3385e1d1f2602d7ad284';

describe('Setting module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: PGClient;
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
        SettingModule,
      ],
    })
      .overrideModule(ApiDepotModule)
      .useModule(MockedApiDepotModule)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    sourceRepository = app.get(getRepositoryToken(Source));
    settingRepository = app.get(getRepositoryToken(Setting));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await sourceRepository.deleteAll();
    await settingRepository.deleteAll();
  });

  describe('GET settings/commune-status/:codeCommune', () => {
    it('should throw 404 if source not found', async () => {
      await request(app.getHttpServer())
        .get(
          `/settings/commune-status/37003?sourceId=10a756b2-f463-453d-9f6f-f27434d699cd`,
        )
        .expect(404);
    });

    it('should return disabled if commune have disabled settings', async () => {
      const source = await createRecording(sourceRepository, testSource);
      await request(app.getHttpServer())
        .post(`/settings/commune-settings/37003`)
        .send({
          disabled: true,
          message: 'Signalement disabled for commune 37003',
        })
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: true,
        message: expect.any(String),
      });
    });

    it('should return disabled if commune have filtered sources', async () => {
      const source = await createRecording(sourceRepository, testSource);
      await request(app.getHttpServer())
        .post(`/settings/commune-settings/37003`)
        .send({
          filteredSources: [source.id],
          message: 'Signalement disabled for commune 37003',
        })
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: true,
        message: expect.any(String),
      });
    });

    it('should return disabled if commune is assemblage', async () => {
      const source = await createRecording(sourceRepository, testSource);

      currentRevisionMock.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: true,
        message: expect.any(String),
      });
    });

    it('should return enabled if the commune is published from mes-adresses', async () => {
      const source = await createRecording(sourceRepository, testSource);
      currentRevisionMock.mockResolvedValueOnce({
        context: {
          extras: { balId: testObjectId },
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: false,
        mode: SignalementSubmissionMode.FULL,
      });
    });

    it('should return enabled if the commune is published from mes-adresses and commune has no custom config', async () => {
      currentRevisionMock.mockResolvedValueOnce({
        context: {
          extras: { balId: testObjectId },
        },
      });

      const source = await createRecording(sourceRepository, testSource);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: false,
        mode: SignalementSubmissionMode.FULL,
      });
    });

    it('should return disabled if the commune is published by moissonneur and not in white list', async () => {
      currentRevisionMock.mockResolvedValueOnce({
        context: {
          extras: { sourceId: testObjectId },
        },
      });

      const source = await createRecording(sourceRepository, testSource);
      await createRecording(
        settingRepository,
        new Setting({
          name: EnabledListKeys.SOURCES_MOISSONNEUR_ENABLED,
          content: [],
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: true,
        message: expect.any(String),
      });
    });

    it('should return enabled if the commune is published by moissonneur and in white list', async () => {
      currentRevisionMock.mockResolvedValueOnce({
        context: {
          extras: { sourceId: testObjectId },
        },
      });

      const source = await createRecording(sourceRepository, testSource);
      await createRecording(
        settingRepository,
        new Setting({
          name: EnabledListKeys.SOURCES_MOISSONNEUR_ENABLED,
          content: [],
        }),
      );

      await request(app.getHttpServer())
        .put(
          `/settings/enabled-list/${EnabledListKeys.SOURCES_MOISSONNEUR_ENABLED}`,
        )
        .send({
          id: testObjectId,
        })
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: false,
        mode: SignalementSubmissionMode.LIGHT,
      });
    });

    it('should return disabled if the commune is published by api-depot and not in white list', async () => {
      currentRevisionMock.mockResolvedValueOnce({
        client: {
          id: testObjectId,
        },
      });

      const source = await createRecording(sourceRepository, testSource);
      await createRecording(
        settingRepository,
        new Setting({
          name: EnabledListKeys.API_DEPOT_CLIENTS_ENABLED,
          content: [],
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: true,
        message: expect.any(String),
      });
    });

    it('should return enabled if the commune is published by api-depot and in white list', async () => {
      currentRevisionMock.mockResolvedValueOnce({
        client: {
          id: testObjectId,
        },
      });
      const source = await createRecording(sourceRepository, testSource);
      await createRecording(
        settingRepository,
        new Setting({
          name: EnabledListKeys.API_DEPOT_CLIENTS_ENABLED,
          content: [],
        }),
      );

      await request(app.getHttpServer())
        .put(
          `/settings/enabled-list/${EnabledListKeys.API_DEPOT_CLIENTS_ENABLED}`,
        )
        .send({
          id: testObjectId,
        })
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: false,
        mode: SignalementSubmissionMode.LIGHT,
      });
    });

    it('should return commune custom config if it is published by api-depot and not in white list', async () => {
      currentRevisionMock.mockResolvedValueOnce({
        client: {
          id: testObjectId,
        },
      });
      const source = await createRecording(sourceRepository, testSource);
      await createRecording(
        settingRepository,
        new Setting({
          name: EnabledListKeys.API_DEPOT_CLIENTS_ENABLED,
          content: [],
        }),
      );

      await request(app.getHttpServer())
        .post(`/settings/commune-settings/37003`)
        .send({
          disabled: false,
          mode: SignalementSubmissionMode.LIGHT,
        })
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: false,
        mode: SignalementSubmissionMode.LIGHT,
      });
    });

    it('should return commune custom config if it is published by api-depot and in white list', async () => {
      currentRevisionMock.mockResolvedValueOnce({
        client: {
          id: testObjectId,
        },
      });
      const source = await createRecording(sourceRepository, testSource);
      await createRecording(
        settingRepository,
        new Setting({
          name: EnabledListKeys.API_DEPOT_CLIENTS_ENABLED,
          content: [],
        }),
      );

      await request(app.getHttpServer())
        .post(`/settings/commune-settings/37003`)
        .send({
          disabled: true,
          message: 'Signalement disabled for commune 37003',
        })
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      await request(app.getHttpServer())
        .put(
          `/settings/enabled-list/${EnabledListKeys.API_DEPOT_CLIENTS_ENABLED}`,
        )
        .send({
          id: testObjectId,
        })
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/settings/commune-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: true,
        message: 'Signalement disabled for commune 37003',
      });
    });
  });
});
