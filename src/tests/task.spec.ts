import { Global, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../modules/task/task.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignalementService } from '../modules/signalement/signalement.service';
import { MesAdressesAPIService } from '../modules/mes-adresses-api/mes-adresses-api.service';
import { MailerService } from '@nestjs-modules/mailer';
import { DataGouvService } from '../modules/datagouv/datagouv.service';
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
import { ReportStatusEnum } from '../common/report-status.enum';
import { AlertModule } from '../modules/alert/alert.module';
import { Alert } from '../modules/alert/alert.entity';
import { AlertTypeEnum } from '../modules/alert/alert.types';
import { ReportModule } from '../modules/report/report.module';

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

const uploadCSVResourceMock = jest.fn(() => Promise.resolve());

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
    {
      provide: DataGouvService,
      useValue: {
        uploadCSVResource: uploadCSVResourceMock,
      },
    },
  ],
  exports: [MesAdressesAPIService, MailerService, DataGouvService],
})
class TestModule {}

describe('Task module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: PGClient;
  let configService: ConfigService;
  let signalementService: SignalementService;
  let signalementRepository: Repository<Signalement>;
  let alertRepository: Repository<Alert>;
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
        AlertModule,
        ReportModule,
      ],
      providers: [TaskService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    configService = app.get<ConfigService>(ConfigService);
    signalementService = app.get<SignalementService>(SignalementService);
    signalementRepository = app.get(getRepositoryToken(Signalement));
    alertRepository = app.get(getRepositoryToken(Alert));
    sourceRepository = app.get(getRepositoryToken(Source));
  });

  afterAll(async () => {
    await app?.close();
    await postgresClient?.end();
    await postgresContainer?.stop();
  });

  afterEach(async () => {
    await alertRepository.delete({});
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

  describe('Task weeklyDataGouvCSVExport', () => {
    beforeEach(() => {
      uploadCSVResourceMock.mockClear();
    });

    it('should skip if DATAGOUV_DATASET_ID is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      await app.get(TaskService).weeklyDataGouvCSVExport();

      expect(uploadCSVResourceMock).not.toHaveBeenCalled();
    });

    it('should generate CSV and upload to data.gouv.fr', async () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        const config = {
          DATAGOUV_DATASET_ID: 'test-dataset-id',
          DATAGOUV_RESOURCE_ID: 'test-resource-id',
        };
        return config[key];
      });

      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Mes signalements',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const createSignalement = (
        codeCommune: string,
        status: ReportStatusEnum,
      ) => {
        const signalement = new Signalement({
          codeCommune,
          author: { email: 'test@test.com' },
          type: SignalementTypeEnum.LOCATION_TO_UPDATE,
          existingLocation: {
            type: ExistingLocationTypeEnum.NUMERO,
            numero: 2,
            suffixe: 'bis',
            position: {
              type: PositionTypeEnum.BATIMENT,
              point: { type: 'Point', coordinates: [0.982904, 47.410998] },
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
                point: { type: 'Point', coordinates: [0.982904, 47.410998] },
              },
            ],
            parcelles: ['37003000BA0744'],
          } as NumeroChangesRequestedDTO,
        });
        signalement.source = source;
        signalement.status = status;
        return signalement;
      };

      // Create signalements with different statuses for two communes
      await createRecording(
        signalementRepository,
        createSignalement('37003', ReportStatusEnum.PENDING),
      );
      await createRecording(
        signalementRepository,
        createSignalement('37003', ReportStatusEnum.PENDING),
      );
      await createRecording(
        signalementRepository,
        createSignalement('37003', ReportStatusEnum.PROCESSED),
      );
      await createRecording(
        signalementRepository,
        createSignalement('37185', ReportStatusEnum.IGNORED),
      );
      await createRecording(
        signalementRepository,
        createSignalement('37185', ReportStatusEnum.EXPIRED),
      );

      const createAlert = (codeCommune: string, status: ReportStatusEnum) => {
        const alert = new Alert({
          codeCommune,
          type: AlertTypeEnum.MISSING_ADDRESS,
          point: {
            type: 'Point',
            coordinates: [0.982904, 47.410998],
          } as any,
          comment: 'Adresse manquante',
          author: { email: 'test@test.com' },
        });
        alert.source = source;
        alert.status = status;
        return alert;
      };

      // Create alerts:
      // - 37003: 1 pending (commune already in signalements)
      // - 37185: 2 processed, 1 ignored
      // - 75056: 1 pending (commune only present via alerts)
      await createRecording(
        alertRepository,
        createAlert('37003', ReportStatusEnum.PENDING),
      );
      await createRecording(
        alertRepository,
        createAlert('37185', ReportStatusEnum.PROCESSED),
      );
      await createRecording(
        alertRepository,
        createAlert('37185', ReportStatusEnum.PROCESSED),
      );
      await createRecording(
        alertRepository,
        createAlert('37185', ReportStatusEnum.IGNORED),
      );
      await createRecording(
        alertRepository,
        createAlert('75056', ReportStatusEnum.PENDING),
      );

      await app.get(TaskService).weeklyDataGouvCSVExport();

      expect(uploadCSVResourceMock).toHaveBeenCalledTimes(1);
      expect(uploadCSVResourceMock).toHaveBeenCalledWith(
        'test-dataset-id',
        'test-resource-id',
        expect.any(String),
        'signalements-par-commune.csv',
      );

      const csvContent = (
        uploadCSVResourceMock.mock.calls as any
      )[0][2] as string;
      const lines = csvContent.split('\n');

      expect(lines[0]).toBe(
        'code_insee,nom_commune,nb_signalements_en_attente,nb_signalements_traites,nb_signalements_ignores,nb_signalements_expires,nb_signalements_total,nb_alertes_en_attente,nb_alertes_traitees,nb_alertes_ignorees,nb_alertes_expirees,nb_alertes_total',
      );

      // Should have header + 3 communes (37003, 37185, 75056)
      expect(lines).toHaveLength(4);

      const commune37003 = lines.find((l) => l.startsWith('37003'));
      const commune37185 = lines.find((l) => l.startsWith('37185'));
      const commune75056 = lines.find((l) => l.startsWith('75056'));

      expect(commune37003).toBeDefined();
      expect(commune37185).toBeDefined();
      expect(commune75056).toBeDefined();

      // 37003: signalements 2 pending, 1 processed, 0, 0, 3 total ; alerts 1 pending, 0, 0, 0, 1 total
      expect(commune37003).toContain(',2,1,0,0,3,1,0,0,0,1');
      // 37185: signalements 0, 0, 1 ignored, 1 expired, 2 total ; alerts 0, 2 processed, 1 ignored, 0, 3 total
      expect(commune37185).toContain(',0,0,1,1,2,0,2,1,0,3');
      // 75056: no signalements ; alerts 1 pending, 0, 0, 0, 1 total
      expect(commune75056).toContain(',0,0,0,0,0,1,0,0,0,1');
    });
  });

  describe('Task anonymizeOldReports', () => {
    const buildSignalement = (
      source: Source,
      status: ReportStatusEnum = ReportStatusEnum.PROCESSED,
    ) => {
      const signalement = new Signalement({
        codeCommune: '37003',
        author: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'Jean.Dupont@Paris.fr',
        },
        type: SignalementTypeEnum.LOCATION_TO_UPDATE,
        existingLocation: {
          type: ExistingLocationTypeEnum.NUMERO,
          numero: 2,
          suffixe: 'bis',
          position: {
            type: PositionTypeEnum.BATIMENT,
            point: { type: 'Point', coordinates: [0.982904, 47.410998] },
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
              point: { type: 'Point', coordinates: [0.982904, 47.410998] },
            },
          ],
          parcelles: ['37003000BA0744'],
        } as NumeroChangesRequestedDTO,
      });
      signalement.source = source;
      signalement.status = status;
      return signalement;
    };

    const setCreatedAt = (id: string, createdAt: Date) =>
      postgresClient.query('UPDATE reports SET created_at = $1 WHERE id = $2', [
        createdAt,
        id,
      ]);

    const getAuthor = async (id: string) => {
      const report = await signalementRepository
        .createQueryBuilder('signalement')
        .addSelect('signalement.author')
        .where('signalement.id = :id', { id })
        .getOne();
      return report?.author;
    };

    it('should anonymize authors of reports older than 3 years and keep recent ones untouched', async () => {
      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Mes signalements',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const oldSignalement = await createRecording(
        signalementRepository,
        buildSignalement(source),
      );
      const recentSignalement = await createRecording(
        signalementRepository,
        buildSignalement(source),
      );

      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 4);
      await setCreatedAt(oldSignalement.id, oldDate);

      const oldAlert = await createRecording(
        alertRepository,
        (() => {
          const alert = new Alert({
            codeCommune: '37185',
            type: AlertTypeEnum.MISSING_ADDRESS,
            point: {
              type: 'Point',
              coordinates: [0.982904, 47.410998],
            } as any,
            comment: 'Adresse manquante',
            author: {
              firstName: 'Marie',
              lastName: 'Martin',
              email: 'marie.martin@gmail.com',
            },
          });
          alert.source = source;
          alert.status = ReportStatusEnum.IGNORED;
          return alert;
        })(),
      );
      await setCreatedAt(oldAlert.id, oldDate);

      await app.get(TaskService).anonymizeOldReports();

      // Old signalement anonymized: PII removed, only domain + timestamp kept
      const oldAuthor = await getAuthor(oldSignalement.id);
      expect(oldAuthor?.firstName).toBeUndefined();
      expect(oldAuthor?.lastName).toBeUndefined();
      expect(oldAuthor?.email).toBeUndefined();
      expect(oldAuthor?.emailDomain).toBe('paris.fr');
      expect(oldAuthor?.anonymizedAt).toBeDefined();

      // Recent signalement untouched
      const recentAuthor = await getAuthor(recentSignalement.id);
      expect(recentAuthor?.firstName).toBe('Jean');
      expect(recentAuthor?.lastName).toBe('Dupont');
      expect(recentAuthor?.email).toBe('Jean.Dupont@Paris.fr');
      expect(recentAuthor?.anonymizedAt).toBeUndefined();

      // Old alert anonymized too (shared reports table)
      const oldAlertRecord = await alertRepository
        .createQueryBuilder('alert')
        .addSelect('alert.author')
        .where('alert.id = :id', { id: oldAlert.id })
        .getOne();
      expect(oldAlertRecord?.author?.email).toBeUndefined();
      expect(oldAlertRecord?.author?.emailDomain).toBe('gmail.com');
      expect(oldAlertRecord?.author?.anonymizedAt).toBeDefined();
    });

    it('should be idempotent and not re-anonymize already anonymized reports', async () => {
      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Mes signalements',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const oldSignalement = await createRecording(
        signalementRepository,
        buildSignalement(source),
      );

      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 4);
      await setCreatedAt(oldSignalement.id, oldDate);

      await app.get(TaskService).anonymizeOldReports();
      const firstPassAuthor = await getAuthor(oldSignalement.id);
      const firstAnonymizedAt = firstPassAuthor?.anonymizedAt;

      await app.get(TaskService).anonymizeOldReports();
      const secondPassAuthor = await getAuthor(oldSignalement.id);

      expect(secondPassAuthor?.anonymizedAt).toEqual(firstAnonymizedAt);
    });

    it('should not anonymize old reports that are still PENDING', async () => {
      const source = await createRecording(
        sourceRepository,
        new Source({
          nom: 'Mes signalements',
          type: SourceTypeEnum.PUBLIC,
        }),
      );

      const oldPendingSignalement = await createRecording(
        signalementRepository,
        buildSignalement(source, ReportStatusEnum.PENDING),
      );

      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 4);
      await setCreatedAt(oldPendingSignalement.id, oldDate);

      await app.get(TaskService).anonymizeOldReports();

      const author = await getAuthor(oldPendingSignalement.id);
      expect(author?.firstName).toBe('Jean');
      expect(author?.lastName).toBe('Dupont');
      expect(author?.email).toBe('Jean.Dupont@Paris.fr');
      expect(author?.anonymizedAt).toBeUndefined();
    });
  });
});
