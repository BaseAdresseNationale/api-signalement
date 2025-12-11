import { Global, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../modules/task/task.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignalementService } from '../modules/signalement/signalement.service';
import { MesAdressesAPIService } from '../modules/mes-adresses-api/mes-adresses-api.service';
import { MailerService } from '@nestjs-modules/mailer';
import { createRecording } from '../utils/test.utils';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Signalement } from '../modules/signalement/signalement.entity';
import { Source } from '../modules/source/source.entity';
import { Repository } from 'typeorm';
import { SourceTypeEnum } from '../modules/source/source.types';
import { SignalementTypeEnum } from '../modules/signalement/signalement.types';
import { ExistingLocationTypeEnum } from '../modules/signalement/schemas/existing-location.schema';
import { PositionTypeEnum } from '../modules/signalement/schemas/position.schema';
import { NumeroChangesRequestedDTO } from '../modules/signalement/dto/changes-requested.dto';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client as PGClient } from 'pg';
import { entities } from '../app.entities';
import { SignalementModule } from '../modules/signalement/signalement.module';

const getPendingSignalementsReportMock = jest.fn(() =>
  Promise.resolve([
    {
      codeCommune: '37185',
      count: 10,
    },
    {
      codeCommune: '37003',
      count: 5,
    },
  ]),
);

const searchBaseLocaleMock = jest.fn(() =>
  Promise.resolve({
    results: [
      {
        id: '1',
        emails: ['toto@pocesurcisse.fr', 'jean-mi@pocesurcisse.fr'],
      },
    ],
  }),
);

const sendMailMock = jest.fn();

@Global()
@Module({
  providers: [
    {
      provide: MesAdressesAPIService,
      useValue: {
        searchBaseLocale: searchBaseLocaleMock,
      },
    },
    {
      provide: MailerService,
      useValue: {
        sendMail: sendMailMock,
      },
    },
  ],
  exports: [MesAdressesAPIService, MailerService],
})
class TestModule {}

describe('Task module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: PGClient;
  let configService: ConfigService;
  let signalementService: SignalementService;
  let signalementRepository: Repository<Signalement>;
  let sourceRepository: Repository<Source>;

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
        TestModule,
        ConfigModule.forFeature(async () => ({
          MES_ADRESSES_URL: 'http://localhost:3000',
          RESET_COMMUNE_FOR_WEBINAIRE: '',
        })),
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
        SignalementModule,
      ],
      providers: [TaskService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    configService = app.get<ConfigService>(ConfigService);
    signalementService = app.get<SignalementService>(SignalementService);
    signalementRepository = app.get(getRepositoryToken(Signalement));
    sourceRepository = app.get(getRepositoryToken(Source));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await signalementRepository.delete({});
    await sourceRepository.delete({});
  });

  describe('Task weeklyPendingSignalementsReport', () => {
    it('should send weekly reports', async () => {
      jest
        .spyOn(signalementService, 'getPendingSignalementsReport')
        .mockImplementation(getPendingSignalementsReportMock);
      await app.get(TaskService).weeklyPendingSignalementsReport();

      expect(getPendingSignalementsReportMock).toHaveBeenCalledTimes(1);
      expect(searchBaseLocaleMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock).toHaveBeenCalledTimes(4);
    });
  });

  describe('Task resetCommuneForWebinaire', () => {
    it('should do nothing if RESET_COMMUNE_FOR_WEBINAIRE is not set', async () => {
      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Mes signalements',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const signalementEntity = new Signalement({
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
      signalementEntity.source = source;

      await createRecording(signalementRepository, signalementEntity);

      await app.get(TaskService).resetCommuneForWebinaire();

      const signalements = await signalementRepository.find();

      expect(signalements).toHaveLength(1);
    });

    it('should delete signalements for the commune set in RESET_COMMUNE_FOR_WEBINAIRE', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('37003');

      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Mes signalements',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const signalementEntity = new Signalement({
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
      signalementEntity.source = source;

      await createRecording(signalementRepository, signalementEntity);

      await app.get(TaskService).resetCommuneForWebinaire();

      const signalements = await signalementRepository.find();

      expect(signalements).toHaveLength(0);
    });
  });
});
