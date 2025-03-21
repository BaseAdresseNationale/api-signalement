import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { CreateClientDTO } from '../modules/client/client.dto';
import { ClientModule } from '../modules/client/client.module';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from '../app.entities';

describe('Client module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;

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
        ClientModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
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
        id: expect.any(String),
        nom: 'Mes adresses',
        token: expect.any(String),
        deletedAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });
});
