import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { CreateSourceDTO } from '../modules/source/source.dto';
import { SourceModule } from '../modules/source/source.module';
import { SourceTypeEnum } from '../modules/source/source.types';
import { createRecording } from '../utils/test.utils';
import { Repository } from 'typeorm';
import { Source } from '../modules/source/source.entity';
import { v4 } from 'uuid';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { entities } from '../app.entities';

describe('Source module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let sourceRepository: Repository<Source>;

  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer(
      'postgis/postgis:12-3.0',
    ).start();

    postgresClient = new Client({
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
        SourceModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
      }),
    );
    await app.init();
    sourceRepository = app.get(getRepositoryToken(Source));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await sourceRepository.deleteAll();
  });

  describe('POST /sources', () => {
    it('should throw 403 if no authorization', async () => {
      const createSourceDTO: CreateSourceDTO = {
        type: SourceTypeEnum.PRIVATE,
        nom: 'SIG Ville',
      };

      await request(app.getHttpServer())
        .post('/sources')
        .send(createSourceDTO)
        .expect(403);
    });

    it('should create a private source', async () => {
      const createSourceDTO: CreateSourceDTO = {
        type: SourceTypeEnum.PRIVATE,
        nom: 'SIG Ville',
      };

      const response = await request(app.getHttpServer())
        .post('/sources')
        .send(createSourceDTO)
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        nom: 'SIG Ville',
        token: expect.any(String),
        type: SourceTypeEnum.PRIVATE,
        deletedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should create a public source', async () => {
      const createSourceDTO: CreateSourceDTO = {
        type: SourceTypeEnum.PUBLIC,
        nom: 'Pifomètre',
      };

      const response = await request(app.getHttpServer())
        .post('/sources')
        .send(createSourceDTO)
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        nom: 'Pifomètre',
        token: null,
        type: SourceTypeEnum.PUBLIC,
        deletedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('GET /sources', () => {
    it('should get all sources', async () => {
      const source1 = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const source2 = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/sources')
        .expect(200);

      expect(response.body).toEqual([
        {
          id: source1.id.toString(),
          nom: source1.nom,
          type: source1.type,
          deletedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        {
          id: source2.id.toString(),
          nom: source2.nom,
          type: source2.type,
          deletedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ]);
    });

    it('should get public sources', async () => {
      const source1 = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/sources?type=PUBLIC')
        .expect(200);

      expect(response.body).toEqual([
        {
          id: source1.id.toString(),
          nom: source1.nom,
          type: source1.type,
          deletedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ]);
    });
  });

  describe('GET /sources/:id', () => {
    it('should get a source by id', async () => {
      const source1 = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/sources/' + source1.id.toString())
        .expect(200);

      expect(response.body).toEqual({
        id: source1.id.toString(),
        nom: source1.nom,
        type: source1.type,
        deletedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should throw 404 if not found', async () => {
      const sourceId = v4();
      await request(app.getHttpServer())
        .get(`/sources/${sourceId}`)
        .expect(404);
    });
  });
});
