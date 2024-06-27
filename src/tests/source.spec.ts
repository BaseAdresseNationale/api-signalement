import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { Connection, Model, Types, connect } from 'mongoose';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { CreateSourceDTO } from '../modules/source/source.dto';
import { SourceModule } from '../modules/source/source.module';
import { SourceTypeEnum } from '../modules/source/source.types';
import { Source } from '../modules/source/source.schema';
import { createRecording } from './tests.utils';

describe('Source module', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let sourceModel: Model<Source>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), SourceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    sourceModel = app.get<Model<Source>>(getModelToken(Source.name));
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
    await app.close();
  });

  afterEach(async () => {
    await sourceModel.deleteMany({});
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
        _id: expect.any(String),
        nom: 'SIG Ville',
        token: expect.any(String),
        type: SourceTypeEnum.PRIVATE,
        __v: 0,
        _deletedAt: null,
        _createdAt: expect.any(String),
        _updatedAt: expect.any(String),
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
        _id: expect.any(String),
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
        __v: 0,
        _deletedAt: null,
        _createdAt: expect.any(String),
        _updatedAt: expect.any(String),
      });
    });
  });

  describe('GET /sources', () => {
    it('should get all sources', async () => {
      const source1 = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });

      const source2 = await createRecording(sourceModel, {
        nom: 'SIG Ville',
        type: SourceTypeEnum.PRIVATE,
      });

      const response = await request(app.getHttpServer())
        .get('/sources')
        .expect(200);

      expect(response.body).toEqual([
        {
          _id: source1._id.toString(),
          nom: source1.nom,
          type: source1.type,
        },
        {
          _id: source2._id.toString(),
          nom: source2.nom,
          type: source2.type,
        },
      ]);
    });

    it('should get public sources', async () => {
      const source1 = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });

      await createRecording(sourceModel, {
        nom: 'SIG Ville',
        type: SourceTypeEnum.PRIVATE,
      });

      const response = await request(app.getHttpServer())
        .get('/sources?type=PUBLIC')
        .expect(200);

      expect(response.body).toEqual([
        {
          _id: source1._id.toString(),
          nom: source1.nom,
          type: source1.type,
        },
      ]);
    });
  });

  describe('GET /sources/:id', () => {
    it('should get a source by id', async () => {
      const source1 = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });

      const response = await request(app.getHttpServer())
        .get('/sources/' + source1._id.toString())
        .expect(200);

      expect(response.body).toEqual({
        _id: source1._id.toString(),
        nom: source1.nom,
        type: source1.type,
      });
    });

    it('should throw 404 if not found', async () => {
      const sourceId = new Types.ObjectId();
      await request(app.getHttpServer())
        .get(`/sources/${sourceId}`)
        .expect(404);
    });
  });
});
