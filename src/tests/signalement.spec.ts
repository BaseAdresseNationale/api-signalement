import { Test, TestingModule } from '@nestjs/testing';
import {
  Global,
  INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { Signalement } from '../modules/signalement/schemas/signalement.schema';
import { Connection, Model, Types, connect } from 'mongoose';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Source } from '../modules/source/source.schema';
import { Client } from '../modules/client/client.schema';
import { createRecording } from './tests.utils';
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
} from 'src/modules/signalement/dto/signalement.dto';
import { MailerService } from '@nestjs-modules/mailer';
import {
  DeleteNumeroChangesRequestedDTO,
  NumeroChangesRequestedDTO,
} from 'src/modules/signalement/dto/changes-requested.dto';
import { SignalementModule } from '../modules/signalement/signalement.module';

const getSerializedSignalement = (
  signalement: Signalement,
  source: Source,
  client?: Client,
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { author, _createdAt, _updatedAt, ...rest } = signalement;
  return {
    ...rest,
    _id: signalement._id.toString(),
    _createdAt: new Date(_createdAt).toISOString(),
    _updatedAt: new Date(_updatedAt).toISOString(),
    source: {
      _id: source._id.toString(),
      nom: source.nom,
      type: source.type,
    },
    ...(client
      ? {
          processedBy: {
            _id: client?._id.toString(),
            nom: client?.nom,
          },
        }
      : {}),
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
  let mongod: MongoMemoryServer;
  let mongoConnection: Connection;
  let signalementModel: Model<Signalement>;
  let sourceModel: Model<Source>;
  let clientModel: Model<Client>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    mongoConnection = (await connect(uri)).connection;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(uri), MailerModule, SignalementModule],
    })
      .overrideProvider(MailerService)
      .useValue(mockMailerService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // INIT MODEL
    signalementModel = app.get<Model<Signalement>>(
      getModelToken(Signalement.name),
    );
    sourceModel = app.get<Model<Source>>(getModelToken(Source.name));
    clientModel = app.get<Model<Client>>(getModelToken(Client.name));
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongod.stop();
    await app.close();
  });

  afterEach(async () => {
    await signalementModel.deleteMany({});
    await sourceModel.deleteMany({});
    await clientModel.deleteMany({});
    mockMailerService.sendMail.mockClear();
  });

  describe('GET /signalements', () => {
    it('should get paginated signalements', async () => {
      const source = await createRecording(sourceModel, {
        nom: 'SIG Ville',
        type: SourceTypeEnum.PRIVATE,
      });

      const signalement1 = await createRecording(signalementModel, {
        source: source,
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
        },
      });

      const signalement2 = await createRecording(signalementModel, {
        source: source,
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

      const signalement3 = await createRecording(signalementModel, {
        source: source,
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
        },
      });

      const response = await request(app.getHttpServer())
        .get('/signalements')
        .expect(200);

      const data = [signalement1, signalement2, signalement3].map(
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
      const source = await createRecording(sourceModel, {
        nom: 'SIG Ville',
        type: SourceTypeEnum.PRIVATE,
      });

      await createRecording(signalementModel, {
        source: source,
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
        },
      });

      const signalement2 = await createRecording(signalementModel, {
        source: source,
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

      const signalement3 = await createRecording(signalementModel, {
        source: source,
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
        },
      });

      const response = await request(app.getHttpServer())
        .get('/signalements?codeCommune=37003')
        .expect(200);

      const data = [signalement2, signalement3].map((signalement) =>
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
      const source1 = await createRecording(sourceModel, {
        nom: 'SIG Ville',
        type: SourceTypeEnum.PRIVATE,
      });

      const source2 = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PRIVATE,
      });

      await createRecording(signalementModel, {
        source: source1,
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
        },
      });

      const signalement2 = await createRecording(signalementModel, {
        source: source2,
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

      const signalement3 = await createRecording(signalementModel, {
        source: source2,
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
        },
      });

      const response = await request(app.getHttpServer())
        .get('/signalements?sourceId=' + source2._id)
        .expect(200);

      const data = [signalement2, signalement3].map((signalement) =>
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
      const source = await createRecording(sourceModel, {
        nom: 'SIG Ville',
        type: SourceTypeEnum.PRIVATE,
      });

      await createRecording(signalementModel, {
        source,
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
        },
      });

      const signalement2 = await createRecording(signalementModel, {
        source,
        status: SignalementStatusEnum.PROCESSED,
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

      const signalement3 = await createRecording(signalementModel, {
        source,
        status: SignalementStatusEnum.PROCESSED,
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
        },
      });

      const response = await request(app.getHttpServer())
        .get('/signalements?status=' + SignalementStatusEnum.PROCESSED)
        .expect(200);

      const data = [signalement2, signalement3].map((signalement) =>
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
      const source = await createRecording(sourceModel, {
        nom: 'SIG Ville',
        type: SourceTypeEnum.PRIVATE,
      });

      const signalement1 = await createRecording(signalementModel, {
        source,
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
        },
      });

      await createRecording(signalementModel, {
        source,
        status: SignalementStatusEnum.PROCESSED,
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

      await createRecording(signalementModel, {
        source,
        status: SignalementStatusEnum.PROCESSED,
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
        },
      });

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
      const source = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });

      const signalement = await createRecording(signalementModel, {
        source,
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
        },
      });

      const response = await request(app.getHttpServer())
        .get('/signalements/' + signalement._id.toString())
        .expect(200);

      expect(response.body).toEqual(
        getSerializedSignalement(signalement, source),
      );
    });

    it('Throw 404 if not found', async () => {
      const signalementId = new Types.ObjectId();

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
      const publicSource = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });
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
        .post(`/signalements?sourceId=${publicSource._id.toString()}`)
        .send(createSignalementDTO)
        .expect(401);
    });

    it('should create a signalement of type LOCATION_TO_CREATE', async () => {
      const privateSource = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PRIVATE,
        token: 'valid_token',
      });

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
        .post(`/signalements?sourceId=${privateSource._id.toString()}`)
        .send(createSignalementDTO)
        .set('Authorization', `Bearer ${privateSource.token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createSignalementDTO,
        __v: 0,
        _id: expect.any(String),
        _createdAt: expect.any(String),
        _updatedAt: expect.any(String),
        _deletedAt: null,
        source: privateSource._id.toString(),
        status: SignalementStatusEnum.PENDING,
      });
    });

    it('should create a signalement of type LOCATION_TO_UPDATE', async () => {
      const privateSource = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PRIVATE,
        token: 'valid_token',
      });

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
        .post(`/signalements?sourceId=${privateSource._id.toString()}`)
        .send(createSignalementDTO)
        .set('Authorization', `Bearer ${privateSource.token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createSignalementDTO,
        __v: 0,
        _id: expect.any(String),
        _createdAt: expect.any(String),
        _updatedAt: expect.any(String),
        _deletedAt: null,
        source: privateSource._id.toString(),
        status: SignalementStatusEnum.PENDING,
      });
    });

    it('should create a signalement of type LOCATION_TO_DELETE', async () => {
      const privateSource = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PRIVATE,
        token: 'valid_token',
      });

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
        .post(`/signalements?sourceId=${privateSource._id.toString()}`)
        .send(createSignalementDTO)
        .set('Authorization', `Bearer ${privateSource.token}`)
        .expect(200);

      expect(response.body).toEqual({
        ...createSignalementDTO,
        __v: 0,
        _id: expect.any(String),
        _createdAt: expect.any(String),
        _updatedAt: expect.any(String),
        _deletedAt: null,
        source: privateSource._id.toString(),
        status: SignalementStatusEnum.PENDING,
      });
    });
  });

  describe('PUT /signalements/:idSignalement', () => {
    it('should throw 401 if invalid authorization', async () => {
      const source = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });

      const signalement = await createRecording(signalementModel, {
        source,
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
        },
      });

      const updateSignalementDTO: UpdateSignalementDTO = {
        status: SignalementStatusEnum.PROCESSED,
      };

      await request(app.getHttpServer())
        .put('/signalements/' + signalement._id.toString())
        .send(updateSignalementDTO)
        .set('Authorization', `Bearer invalid_token`)
        .expect(401);
    });

    it('should update a signalement with email notification', async () => {
      const source = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });

      const client = await createRecording(clientModel, {
        nom: 'Mes adresses',
      });

      const signalement = await createRecording(signalementModel, {
        source,
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
        },
      });

      const updateSignalementDTO: UpdateSignalementDTO = {
        status: SignalementStatusEnum.PROCESSED,
      };

      const response = await request(app.getHttpServer())
        .put('/signalements/' + signalement._id.toString())
        .send(updateSignalementDTO)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedSignalement(
          { ...signalement, ...updateSignalementDTO },
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
      const source = await createRecording(sourceModel, {
        nom: 'Pifomètre',
        type: SourceTypeEnum.PUBLIC,
      });

      const client = await createRecording(clientModel, {
        nom: 'Mes adresses',
      });

      const signalement = await createRecording(signalementModel, {
        source,
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
        },
      });

      const updateSignalementDTO: UpdateSignalementDTO = {
        status: SignalementStatusEnum.PROCESSED,
      };

      const response = await request(app.getHttpServer())
        .put('/signalements/' + signalement._id.toString())
        .send(updateSignalementDTO)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      expect(response.body).toEqual(
        getSerializedSignalement(
          { ...signalement, ...updateSignalementDTO },
          source,
          client,
        ),
      );

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });
  });
});
