import { Test, TestingModule } from '@nestjs/testing';
import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { SourceTypeEnum } from '../modules/source/source.types';
import {
  SignalementStatusEnum,
  SignalementTypeEnum,
} from '../modules/signalement/signalement.types';
import {
  ExistingLocationTypeEnum,
  ExistingNumero,
  ExistingVoie,
} from '../modules/signalement/schemas/existing-location.schema';
import { PositionTypeEnum } from '../modules/signalement/schemas/position.schema';
import {
  CreateSignalementDTO,
  UpdateSignalementDTO,
} from '../modules/signalement/dto/signalement.dto';
import { MailerService } from '@nestjs-modules/mailer';
import {
  DeleteNumeroChangesRequestedDTO,
  NumeroChangesRequestedDTO,
} from '../modules/signalement/dto/changes-requested.dto';
import { SignalementModule } from '../modules/signalement/signalement.module';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Repository } from 'typeorm';
import { Client } from 'pg';
import { entities } from '../app.entities';
import { SignalementEntity } from '../modules/signalement/signalement.entity';
import { SourceEntity } from '../modules/source/source.entity';
import { ClientEntity } from '../modules/client/client.entity';
import { createRecording } from '../utils/test.utils';
import { v4 } from 'uuid';

const getSerializedSignalement = (
  signalement: SignalementEntity,
  source: SourceEntity,
  client?: ClientEntity,
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { author, createdAt, updatedAt, ...rest } = signalement;
  return {
    ...rest,
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
  };
};

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

describe('Signalement module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let signalementRepository: Repository<SignalementEntity>;
  let clientRepository: Repository<ClientEntity>;
  let sourceRepository: Repository<SourceEntity>;

  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer().start();

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
        MailerModule,
        SignalementModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // INIT MODEL
    signalementRepository = app.get(getRepositoryToken(SignalementEntity));
    sourceRepository = app.get(getRepositoryToken(SourceEntity));
    clientRepository = app.get(getRepositoryToken(ClientEntity));
  });

  afterAll(async () => {
    await postgresClient.end();
    await postgresContainer.stop();
    await app.close();
  });

  afterEach(async () => {
    await signalementRepository.delete({});
    await sourceRepository.delete({});
    await clientRepository.delete({});
    mockMailerService.sendMail.mockClear();
  });

  describe('GET /signalements', () => {
    it('should get paginated signalements', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement1Entity = new SignalementEntity({
        codeCommune: '37003',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalement1Entity.source = source;

      const signalement1 = await createRecording(
        signalementRepository,
        signalement1Entity,
      );

      const signalement2Entity = new SignalementEntity({
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

      signalement2Entity.source = source;

      const signalement2 = await createRecording(
        signalementRepository,
        signalement2Entity,
      );

      const signalement3Entity = new SignalementEntity({
        codeCommune: '37003',
        author: {
          email: 'test@test.com',
        },
        type: SignalementTypeEnum.LOCATION_TO_CREATE,
        existingLocation: {
          type: ExistingLocationTypeEnum.VOIE,
          nom: 'Rue de la Paix',
        },
        changesRequested: {
          numero: 25,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });

      signalement3Entity.source = source;

      const signalement3 = await createRecording(
        signalementRepository,
        signalement3Entity,
      );

      const response = await request(app.getHttpServer())
        .get('/signalements')
        .expect(200);

      const data = [signalement3, signalement2, signalement1].map(
        (signalement) => getSerializedSignalement(signalement, source),
      );

      expect(response.body).toEqual({
        data,
        total: 3,
        page: 1,
        limit: 100,
      });
    });

    it('should get signalements by commune', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalementEntity = new SignalementEntity({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });

      signalementEntity.source = source;

      await createRecording(signalementRepository, signalementEntity);

      const signalement2Entity = new SignalementEntity({
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

      signalement2Entity.source = source;

      const signalement2 = await createRecording(
        signalementRepository,
        signalement2Entity,
      );

      const signalement3Entity = new SignalementEntity({
        codeCommune: '37003',
        author: {
          email: 'test@test.com',
        },
        type: SignalementTypeEnum.LOCATION_TO_CREATE,
        existingLocation: {
          type: ExistingLocationTypeEnum.VOIE,
          nom: 'Rue de la Paix',
        },
        changesRequested: {
          numero: 25,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });

      signalement3Entity.source = source;

      const signalement3 = await createRecording(
        signalementRepository,
        signalement3Entity,
      );

      const response = await request(app.getHttpServer())
        .get('/signalements?codeCommune=37003')
        .expect(200);

      const data = [signalement3, signalement2].map((signalement) =>
        getSerializedSignalement(signalement, source),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 100,
      });
    });

    it('should get signalements by source', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: token1, ...source1 } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: token2, ...source2 } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement1Entity = new SignalementEntity({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });

      signalement1Entity.source = source1;

      await createRecording(signalementRepository, signalement1Entity);

      const signalement2Entity = new SignalementEntity({
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

      signalement2Entity.source = source2;

      const signalement2 = await createRecording(
        signalementRepository,
        signalement2Entity,
      );

      const signalement3Entity = new SignalementEntity({
        codeCommune: '37003',
        author: {
          email: 'test@test.com',
        },
        type: SignalementTypeEnum.LOCATION_TO_CREATE,
        existingLocation: {
          type: ExistingLocationTypeEnum.VOIE,
          nom: 'Rue de la Paix',
        },
        changesRequested: {
          numero: 25,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });

      signalement3Entity.source = source2;

      const signalement3 = await createRecording(
        signalementRepository,
        signalement3Entity,
      );

      const response = await request(app.getHttpServer())
        .get('/signalements?sourceId=' + source2.id)
        .expect(200);

      const data = [signalement3, signalement2].map((signalement) =>
        getSerializedSignalement(signalement, source2),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 100,
      });
    });

    it('should get signalements by status', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement1Entity = new SignalementEntity({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });

      signalement1Entity.source = source;

      await createRecording(signalementRepository, signalement1Entity);

      const signalement2Entity = new SignalementEntity({
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

      signalement2Entity.status = SignalementStatusEnum.PROCESSED;
      signalement2Entity.source = source;

      const signalement2 = await createRecording(
        signalementRepository,
        signalement2Entity,
      );

      const signalement3Entity = new SignalementEntity({
        codeCommune: '37003',
        author: {
          email: 'test@test.com',
        },
        type: SignalementTypeEnum.LOCATION_TO_CREATE,
        existingLocation: {
          type: ExistingLocationTypeEnum.VOIE,
          nom: 'Rue de la Paix',
        },
        changesRequested: {
          numero: 25,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalement3Entity.source = source;
      signalement3Entity.status = SignalementStatusEnum.PROCESSED;

      const signalement3 = await createRecording(
        signalementRepository,
        signalement3Entity,
      );

      const response = await request(app.getHttpServer())
        .get('/signalements?status=' + SignalementStatusEnum.PROCESSED)
        .expect(200);

      const data = [signalement3, signalement2].map((signalement) =>
        getSerializedSignalement(signalement, source),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 100,
      });
    });

    it('should get signalements by type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement1Entity = new SignalementEntity({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalement1Entity.source = source;

      const signalement1 = await createRecording(
        signalementRepository,
        signalement1Entity,
      );

      const signalement2Entity = new SignalementEntity({
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
      signalement2Entity.source = source;
      signalement2Entity.status = SignalementStatusEnum.PROCESSED;

      await createRecording(signalementRepository, signalement2Entity);

      const signalement3Entity = new SignalementEntity({
        codeCommune: '37003',
        author: {
          email: 'test@test.com',
        },
        type: SignalementTypeEnum.LOCATION_TO_CREATE,
        existingLocation: {
          type: ExistingLocationTypeEnum.VOIE,
          nom: 'Rue de la Paix',
        },
        changesRequested: {
          numero: 25,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalement3Entity.source = source;
      signalement3Entity.status = SignalementStatusEnum.PROCESSED;

      await createRecording(signalementRepository, signalement3Entity);

      const response = await request(app.getHttpServer())
        .get('/signalements?type=' + SignalementTypeEnum.LOCATION_TO_UPDATE)
        .expect(200);

      const data = [signalement1].map((signalement) =>
        getSerializedSignalement(signalement, source),
      );

      expect(response.body).toEqual({
        data,
        total: 1,
        page: 1,
        limit: 100,
      });
    });
  });

  describe('GET /signalements/:idSignalement', () => {
    it('should get a signalement by id', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const signalementEntity = new SignalementEntity({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalementEntity.source = source;

      const signalement = await createRecording(
        signalementRepository,
        signalementEntity,
      );

      const response = await request(app.getHttpServer())
        .get('/signalements/' + signalement.id)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedSignalement(signalement, source),
      );
    });

    it('Throw 404 if not found', async () => {
      const signalementId = v4();

      await request(app.getHttpServer())
        .get(`/signalements/${signalementId}`)
        .expect(404);
    });
  });

  describe('POST /signalements', () => {
    it('should throw 401 if invalid authorization', async () => {
      const createSignalementDTO: CreateSignalementDTO = {
        codeCommune: '37001',
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
        } as ExistingNumero,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
          nomVoie: 'Rue de la Paix',
        } as NumeroChangesRequestedDTO,
      };

      await request(app.getHttpServer())
        .post('/signalements')
        .send(createSignalementDTO)
        .set('Authorization', `Bearer invalid_token`)
        .expect(401);
    });

    it('should throw 401 if no token and invalid captcha', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...publicSource } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );
      const createSignalementDTO: CreateSignalementDTO = {
        codeCommune: '37001',
        type: SignalementTypeEnum.LOCATION_TO_UPDATE,
        author: {
          email: '',
          captchaToken: 'invalid_token',
        },
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
        } as ExistingNumero,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
          nomVoie: 'Rue de la Paix',
        } as NumeroChangesRequestedDTO,
      };

      await request(app.getHttpServer())
        .post(`/signalements?sourceId=${publicSource.id}`)
        .send(createSignalementDTO)
        .expect(401);
    });

    it('should create a signalement of type LOCATION_TO_CREATE', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const createSignalementDTO: CreateSignalementDTO = {
        codeCommune: '37001',
        type: SignalementTypeEnum.LOCATION_TO_CREATE,
        changesRequested: {
          numero: 3,
          suffixe: 'bis',
          positions: [
            {
              type: PositionTypeEnum.BATIMENT,
              point: {
                type: 'Point',
                coordinates: [0.982904, 47.410998],
              },
            },
          ],
          parcelles: ['37003000BA0744', '37003000BA0743'],
          nomVoie: 'Rue de la Paix',
        } as NumeroChangesRequestedDTO,
        existingLocation: {
          type: ExistingLocationTypeEnum.VOIE,
          nom: 'Rue de la Paix',
        } as ExistingVoie,
      };

      const response = await request(app.getHttpServer())
        .post(`/signalements?sourceId=${privateSource.id}`)
        .send(createSignalementDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createSignalementDTO,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: SignalementStatusEnum.PENDING,
      });
    });

    it('should create a signalement of type LOCATION_TO_UPDATE', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const createSignalementDTO: CreateSignalementDTO = {
        codeCommune: '37001',
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
        } as ExistingNumero,
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
          nomVoie: 'Rue de la Paix',
        } as NumeroChangesRequestedDTO,
      };

      const response = await request(app.getHttpServer())
        .post(`/signalements?sourceId=${privateSource.id}`)
        .send(createSignalementDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createSignalementDTO,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: SignalementStatusEnum.PENDING,
      });
    });

    it('should create a signalement of type LOCATION_TO_DELETE', async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const createSignalementDTO: CreateSignalementDTO = {
        codeCommune: '37001',
        type: SignalementTypeEnum.LOCATION_TO_DELETE,
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
        } as ExistingNumero,
        changesRequested: {
          comment: 'à supprimer car doublon',
        } as DeleteNumeroChangesRequestedDTO,
      };

      const response = await request(app.getHttpServer())
        .post(`/signalements?sourceId=${privateSource.id}`)
        .send(createSignalementDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createSignalementDTO,
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: SignalementStatusEnum.PENDING,
      });
    });
  });

  describe('PUT /signalements/:idSignalement', () => {
    it('should throw 401 if invalid authorization', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const signalementEntity = new SignalementEntity({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalementEntity.source = source;

      const signalement = await createRecording(
        signalementRepository,
        signalementEntity,
      );

      const updateSignalementDTO: UpdateSignalementDTO = {
        status: SignalementStatusEnum.PROCESSED,
      };

      await request(app.getHttpServer())
        .put('/signalements/' + signalement.id)
        .send(updateSignalementDTO)
        .set('Authorization', `Bearer invalid_token`)
        .expect(401);
    });

    it('should update a signalement with email notification', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: sourceToken, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const { token: clientToken, ...client } = await createRecording(
        clientRepository,
        new ClientEntity({
          nom: 'Mes adresses',
        }),
      );

      const signalementEntity = new SignalementEntity({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
        },
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalementEntity.source = source;

      const signalement = await createRecording(
        signalementRepository,
        signalementEntity,
      );

      const updateSignalementDTO: UpdateSignalementDTO = {
        status: SignalementStatusEnum.PROCESSED,
      };

      const response = await request(app.getHttpServer())
        .put('/signalements/' + signalement.id)
        .send(updateSignalementDTO)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedSignalement(
          {
            ...signalement,
            ...updateSignalementDTO,
            updatedAt: expect.any(String),
          },
          source,
          client,
        ),
      );

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        context: {
          signalement: expect.any(Object),
        },
        to: 'test@test.com',
        subject: 'Votre signalement a bien été pris en compte',
        template: 'processed',
      });
    });

    it('should update a signalement without email notification', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: sourceToken, ...source } = await createRecording(
        sourceRepository,
        new SourceEntity({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token: clientToken, ...client } = await createRecording(
        clientRepository,
        new ClientEntity({
          nom: 'Mes adresses',
        }),
      );

      const signalementEntity = new SignalementEntity({
        codeCommune: '37001',
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
          parcelles: ['37003000BA0744', '37003000BA0743'],
        } as NumeroChangesRequestedDTO,
      });
      signalementEntity.source = source;

      const signalement = await createRecording(
        signalementRepository,
        signalementEntity,
      );

      const updateSignalementDTO: UpdateSignalementDTO = {
        status: SignalementStatusEnum.PROCESSED,
      };

      const response = await request(app.getHttpServer())
        .put('/signalements/' + signalement.id)
        .send(updateSignalementDTO)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedSignalement(
          {
            ...signalement,
            ...updateSignalementDTO,
            updatedAt: expect.any(String),
          },
          source,
          client,
        ),
      );

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });
  });
});
