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

const currentRevisionMock = jest.fn();

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
    await sourceRepository.delete({});
    await settingRepository.delete({});
  });

  describe('GET settings/communes-status/:codeCommune', () => {
    it('should throw 404 if source not found', async () => {
      await request(app.getHttpServer())
        .get(
          `/settings/communes-status/37003?sourceId=10a756b2-f463-453d-9f6f-f27434d699cd`,
        )
        .expect(404);
    });

    it('should return disabled if commune is assemblage', async () => {
      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      currentRevisionMock.mockResolvedValueOnce(null);

      const response = await request(app.getHttpServer())
        .get(`/settings/communes-status/37003?sourceId=${source.id}`)
        .expect(200);

      expect(response.body).toEqual({
        disabled: true,
        message: expect.any(String),
      });
    });

    /*     it('should return disabled if commune is published from mes-adresses and have disabled settings', async () => {});
     */
  });
});
