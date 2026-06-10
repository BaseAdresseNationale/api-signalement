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
    await app?.close();
    await postgresClient?.end();
    await postgresContainer?.stop();
  });

  afterEach(async () => {
    await sourceRepository.delete({});
  });

  describe('POST /sources', () => {
    it('should throw 403 if no authorization', async () => {
      const createSourceDTO: CreateSourceDTO = {
        type: SourceTypeEnum.PRIVATE,
        nom: 'SIG Ville',
        siret: '12345678901234',
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
        siret: '12345678901234',
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
        siret: '12345678901234',
        defaultAuthor: null,
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
        siret: null,
        defaultAuthor: null,
        type: SourceTypeEnum.PUBLIC,
        deletedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should reject a private source without siret', async () => {
      const createSourceDTO = {
        type: SourceTypeEnum.PRIVATE,
        nom: 'SIG Ville',
      };

      const response = await request(app.getHttpServer())
        .post('/sources')
        .send(createSourceDTO)
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('siret is required for PRIVATE sources'),
        ]),
      );
    });

    it('should create a public source without siret', async () => {
      const createSourceDTO: CreateSourceDTO = {
        type: SourceTypeEnum.PUBLIC,
        nom: 'Source Publique',
      };

      const response = await request(app.getHttpServer())
        .post('/sources')
        .send(createSourceDTO)
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body.siret).toBeNull();
    });

    it('should create a private source with a defaultAuthor', async () => {
      const createSourceDTO: CreateSourceDTO = {
        type: SourceTypeEnum.PRIVATE,
        nom: 'SIG Ville',
        siret: '12345678901234',
        defaultAuthor: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
        },
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
        siret: '12345678901234',
        defaultAuthor: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
        },
        deletedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should ignore defaultAuthor for a public source', async () => {
      const createSourceDTO: CreateSourceDTO = {
        type: SourceTypeEnum.PUBLIC,
        nom: 'Pifomètre',
        defaultAuthor: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/sources')
        .send(createSourceDTO)
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body.defaultAuthor).toBeNull();
    });

    it('should reject an invalid defaultAuthor email', async () => {
      const createSourceDTO = {
        type: SourceTypeEnum.PRIVATE,
        nom: 'SIG Ville',
        siret: '12345678901234',
        defaultAuthor: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'not-an-email',
        },
      };

      await request(app.getHttpServer())
        .post('/sources')
        .send(createSourceDTO)
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(400);
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
          siret: '12345678901234',
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
          siret: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        {
          id: source2.id.toString(),
          nom: source2.nom,
          type: source2.type,
          deletedAt: null,
          siret: source2.siret,
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
          siret: '12345678901234',
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
          siret: null,
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
        siret: null,
      });
    });

    it('should throw 404 if not found', async () => {
      const sourceId = v4();
      await request(app.getHttpServer())
        .get(`/sources/${sourceId}`)
        .expect(404);
    });
  });

  describe('PUT /sources/:idSource', () => {
    it('should throw 401 if no authorization', async () => {
      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
          siret: '12345678901234',
        }),
      );

      await request(app.getHttpServer())
        .put(`/sources/${source.id}`)
        .send({ nom: 'New name' })
        .expect(401);
    });

    it('should update the nom of a source', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
          siret: '12345678901234',
        }),
      );

      const response = await request(app.getHttpServer())
        .put(`/sources/${privateSource.id}`)
        .send({ nom: 'SIG Ville renommée' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.nom).toBe('SIG Ville renommée');
    });

    it('should update the defaultAuthor of a private source', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
          siret: '12345678901234',
        }),
      );

      const response = await request(app.getHttpServer())
        .put(`/sources/${privateSource.id}`)
        .send({
          defaultAuthor: {
            firstName: 'Jean',
            lastName: 'Dupont',
            email: 'jean.dupont@example.com',
          },
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.defaultAuthor).toEqual({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
      });
    });

    it('should update both nom and defaultAuthor', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
          siret: '12345678901234',
        }),
      );

      const response = await request(app.getHttpServer())
        .put(`/sources/${privateSource.id}`)
        .send({
          nom: 'SIG Ville renommée',
          defaultAuthor: {
            firstName: 'Jean',
            lastName: 'Dupont',
            email: 'jean.dupont@example.com',
          },
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.nom).toBe('SIG Ville renommée');
      expect(response.body.defaultAuthor).toEqual({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
      });
    });

    it('should reject an invalid defaultAuthor email', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
          siret: '12345678901234',
        }),
      );

      await request(app.getHttpServer())
        .put(`/sources/${privateSource.id}`)
        .send({
          defaultAuthor: {
            email: 'not-an-email',
          },
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should allow the source owner to update its own source', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
          siret: '12345678901234',
        }),
      );

      const response = await request(app.getHttpServer())
        .put(`/sources/${privateSource.id}`)
        .send({
          nom: 'SIG Ville renommée',
          defaultAuthor: {
            firstName: 'Jean',
            lastName: 'Dupont',
            email: 'jean.dupont@example.com',
          },
        })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.nom).toBe('SIG Ville renommée');
      expect(response.body.defaultAuthor).toEqual({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
      });
    });

    it('should reject a source owner trying to update another source', async () => {
      const source1 = new Source({
        nom: 'SIG Ville 1',
        type: SourceTypeEnum.PRIVATE,
        siret: '12345678901234',
      });
      const { token: token1 } = await createRecording(
        sourceRepository,
        source1,
      );

      const source2 = new Source({
        nom: 'SIG Ville 2',
        type: SourceTypeEnum.PRIVATE,
        siret: '98765432109876',
      });
      const privateSource2 = await createRecording(sourceRepository, source2);

      await request(app.getHttpServer())
        .put(`/sources/${privateSource2.id}`)
        .send({ nom: 'Hijack' })
        .set('Authorization', `Bearer ${token1}`)
        .expect(403);
    });

    it('should reject an unknown bearer token', async () => {
      const privateSource = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
          siret: '12345678901234',
        }),
      );

      await request(app.getHttpServer())
        .put(`/sources/${privateSource.id}`)
        .send({ nom: 'New name' })
        .set('Authorization', 'Bearer unknown-token')
        .expect(401);
    });
  });
});
