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
import { Client as PGClient } from 'pg';
import { entities } from '../app.entities';
import { Signalement } from '../modules/signalement/signalement.entity';
import { Source } from '../modules/source/source.entity';
import { Client } from '../modules/client/client.entity';
import { createRecording } from '../utils/test.utils';
import { v4 } from 'uuid';
import { getCommune } from '../utils/cog.utils';
import { Setting } from '../modules/setting/setting.entity';
import { ApiDepotService } from '../modules/api-depot/api-depot.service';
import { ApiDepotModule } from '../modules/api-depot/api-depot.module';

const getSerializedSignalement = (
  signalement: Signalement,
  source: Source,
  client?: Client,
  withAuthor?: boolean,
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { codeCommune, author, createdAt, updatedAt, ...rest } = signalement;
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

describe('Signalement module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: PGClient;
  let signalementRepository: Repository<Signalement>;
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
        SignalementModule,
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
    signalementRepository = app.get(getRepositoryToken(Signalement));
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
    await signalementRepository.delete({});
    await sourceRepository.delete({});
    await clientRepository.delete({});
    await settingRepository.delete({});
    mockMailerService.sendMail.mockClear();
  });

  describe('GET /signalements', () => {
    it('should get paginated signalements', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement1Entity = new Signalement({
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

      const signalement2Entity = new Signalement({
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

      const signalement3Entity = new Signalement({
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
        limit: 20,
      });
    });

    it('should get signalements by commune', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement = new Signalement({
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

      signalement.source = source;

      await createRecording(signalementRepository, signalement);

      const signalement2Entity = new Signalement({
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

      const signalement3Entity = new Signalement({
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
        .get('/signalements?codeCommunes=37003')
        .expect(200);

      const data = [signalement3, signalement2].map((signalement) =>
        getSerializedSignalement(signalement, source),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 20,
      });
    });

    it('should get signalements by source', async () => {
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

      const signalement1Entity = new Signalement({
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

      const signalement2Entity = new Signalement({
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

      const signalement3Entity = new Signalement({
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
        .get('/signalements?sourceIds=' + source2.id)
        .expect(200);

      const data = [signalement3, signalement2].map((signalement) =>
        getSerializedSignalement(signalement, source2),
      );

      expect(response.body).toEqual({
        data,
        total: 2,
        page: 1,
        limit: 20,
      });
    });

    it('should get signalements by status', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement1Entity = new Signalement({
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

      const signalement2Entity = new Signalement({
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

      const signalement3Entity = new Signalement({
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
        limit: 20,
      });
    });

    it('should get signalements by type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'SIG Ville',
          type: SourceTypeEnum.PRIVATE,
        }),
      );

      const signalement1Entity = new Signalement({
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

      const signalement2Entity = new Signalement({
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

      const signalement3Entity = new Signalement({
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
        .get('/signalements?types=' + SignalementTypeEnum.LOCATION_TO_UPDATE)
        .expect(200);

      const data = [signalement1].map((signalement) =>
        getSerializedSignalement(signalement, source),
      );

      expect(response.body).toEqual({
        data,
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('GET /signalements/:idSignalement', () => {
    it('should get a signalement by id (with author infos)', async () => {
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

      const signalementEntity = new Signalement({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
          firstName: 'John',
          lastName: 'Doe',
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
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedSignalement(signalement, source, null, true),
      );
    });

    it('should get a signalement by id (without author infos)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const signalementEntity = new Signalement({
        codeCommune: '37001',
        author: {
          email: 'test@test.com',
          firstName: 'John',
          lastName: 'Doe',
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
        new Source({
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
        new Source({
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
        nomCommune: getCommune(createSignalementDTO.codeCommune)?.nom,
        id: expect.any(String),
        point: {
          coordinates: expect.any(Array),
          type: 'Point',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        rejectionReason: null,
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
        new Source({
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
        nomCommune: getCommune(createSignalementDTO.codeCommune)?.nom,
        point: {
          coordinates: expect.any(Array),
          type: 'Point',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        rejectionReason: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: SignalementStatusEnum.PENDING,
      });
    });

    it("should cast the numero to type number with pipe if it's a string", async () => {
      const { token, ...privateSource } = await createRecording(
        sourceRepository,
        new Source({
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
          numero: '3' as unknown as number,
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
        changesRequested: {
          ...createSignalementDTO.changesRequested,
          numero: 3,
        },
        id: expect.any(String),
        nomCommune: getCommune(createSignalementDTO.codeCommune)?.nom,
        point: {
          coordinates: expect.any(Array),
          type: 'Point',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        rejectionReason: null,
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
        new Source({
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
        nomCommune: getCommune(createSignalementDTO.codeCommune)?.nom,
        point: {
          coordinates: expect.any(Array),
          type: 'Point',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        processedBy: null,
        rejectionReason: null,
        source: {
          ...privateSource,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        status: SignalementStatusEnum.PENDING,
      });
    });

    it('should return a 400 error if the commune is disabled', async () => {
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

      await request(app.getHttpServer())
        .post(`/signalements?sourceId=${privateSource.id}`)
        .send(createSignalementDTO)
        .set('Authorization', `Bearer ${token}`)
        .expect(405);
    });
  });

  describe('PUT /signalements/:idSignalement', () => {
    it('should throw 401 if invalid authorization', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, ...source } = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Pifomètre',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const signalementEntity = new Signalement({
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

      const signalementEntity = new Signalement({
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
          date: expect.any(String),
          commune: 'Abilly',
          location: '2 bis Rue de la Paix - Abilly',
          locationType: `l'adresse`,
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

      const signalementEntity = new Signalement({
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

    it('should update a signalement with email notification and rejection reason', async () => {
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

      const signalementEntity = new Signalement({
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
        status: SignalementStatusEnum.IGNORED,
        rejectionReason: 'Signalement non pertinent',
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
          date: expect.any(String),
          commune: 'Abilly',
          location: '2 bis Rue de la Paix - Abilly',
          locationType: "l'adresse",
          rejectionReason: 'Signalement non pertinent',
        },
        subject: "Votre signalement n'a pas été pris en compte",
        template: 'ignored',
        to: 'test@test.com',
      });
    });
  });
});
