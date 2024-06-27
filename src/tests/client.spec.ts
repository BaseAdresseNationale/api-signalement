import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { Connection, connect } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { CreateClientDTO } from '../modules/client/client.dto';
import { ClientModule } from '../modules/client/client.module';

describe('Client module', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), ClientModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
    await app.close();
  });

  describe('POST /clients', () => {
    it('should throw 403 if no authorization token', async () => {
      const createClientDTO: CreateClientDTO = {
        nom: 'Mes adresses',
      };

      await request(app.getHttpServer())
        .post('/clients')
        .send(createClientDTO)
        .expect(403);
    });

    it('should create a new client', async () => {
      const createClientDTO: CreateClientDTO = {
        nom: 'Mes adresses',
      };

      const response = await request(app.getHttpServer())
        .post('/clients')
        .send(createClientDTO)
        .set('Authorization', `Bearer ${process.env.ADMIN_TOKEN}`)
        .expect(200);

      expect(response.body).toEqual({
        _id: expect.any(String),
        nom: 'Mes adresses',
        token: expect.any(String),
        __v: 0,
        _deletedAt: null,
        _createdAt: expect.any(String),
        _updatedAt: expect.any(String),
      });
    });
  });
});
