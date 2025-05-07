import { Global, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../modules/notification/notification.service';
import { ConfigModule } from '@nestjs/config';
import { SignalementService } from '../modules/signalement/signalement.service';
import { MesAdressesAPIService } from '../modules/mes-adresses-api/mes-adresses-api.service';
import { MailerService } from '@nestjs-modules/mailer';

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
      provide: SignalementService,
      useValue: {
        getPendingSignalementsReport: getPendingSignalementsReportMock,
      },
    },
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
  exports: [SignalementService, MesAdressesAPIService, MailerService],
})
class TestModule {}

describe('Notification module', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TestModule,
        ConfigModule.forFeature(async () => ({
          MES_ADRESSES_URL: 'http://localhost:3000',
        })),
      ],
      providers: [NotificationService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Task weeklyPendingSignalementsReport', () => {
    it('should send weekly reports', async () => {
      await app.get(NotificationService).weeklyPendingSignalementsReport();

      expect(getPendingSignalementsReportMock).toHaveBeenCalledTimes(1);
      expect(searchBaseLocaleMock).toHaveBeenCalledTimes(2);
      expect(sendMailMock).toHaveBeenCalledTimes(4);
    });
  });
});
