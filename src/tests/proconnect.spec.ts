import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import {
  HttpException,
  HttpStatus,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { entities } from '../app.entities';
import { SourceModule } from '../modules/source/source.module';
import { Source } from '../modules/source/source.entity';
import { SourceTypeEnum } from '../modules/source/source.types';
import { Repository } from 'typeorm';
import { createRecording } from '../utils/test.utils';
import {
  ProConnectService,
  ProConnectUserInfo,
} from '../modules/proconnect/proconnect.service';
import { InseeService } from '../modules/proconnect/insee.service';
import { ProConnectModule } from '../modules/proconnect/proconnect.module';
import * as cookieParser from 'cookie-parser';

const MES_SIGNALEMENTS_URL = 'http://localhost:7777';

jest.setTimeout(60000);

describe('ProConnect module', () => {
  let app: INestApplication;
  let postgresContainer: StartedPostgreSqlContainer;
  let postgresClient: Client;
  let sourceRepository: Repository<Source>;
  let proConnectService: ProConnectService;
  let inseeService: InseeService;

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
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              MES_SIGNALEMENTS_URL,
              API_SIGNALEMENT_URL: 'http://localhost:5005',
            }),
          ],
          ignoreEnvFile: true,
        }),
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
        ProConnectModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
      }),
    );
    await app.init();
    sourceRepository = app.get(getRepositoryToken(Source));
    proConnectService = app.get(ProConnectService);
    inseeService = app.get(InseeService);
  });

  afterAll(async () => {
    await app?.close();
    await postgresClient?.end();
    await postgresContainer?.stop();
  });

  afterEach(async () => {
    await sourceRepository.delete({});
  });

  describe('GET /proconnect/login', () => {
    it('should redirect to ProConnect authorization URL', async () => {
      const mockAuthUrl = 'https://proconnect.example.com/authorize?state=abc';
      jest
        .spyOn(proConnectService, 'getAuthorizationUrl')
        .mockResolvedValueOnce(mockAuthUrl);

      const response = await request(app.getHttpServer())
        .get('/proconnect/login')
        .expect(302);

      expect(response.headers.location).toBe(mockAuthUrl);

      // Should set state and nonce cookies
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStrings = Array.isArray(cookies) ? cookies : [cookies];
      expect(
        cookieStrings.some((c: string) => c.includes('proconnect_state')),
      ).toBe(true);
      expect(
        cookieStrings.some((c: string) => c.includes('proconnect_nonce')),
      ).toBe(true);
      // Cookies should be HttpOnly
      expect(
        cookieStrings.some(
          (c: string) =>
            c.includes('proconnect_state') && c.includes('HttpOnly'),
        ),
      ).toBe(true);
    });
  });

  describe('GET /proconnect/callback', () => {
    it('should redirect to frontend with source info when SIRET matches existing source', async () => {
      const source = await createRecording(
        sourceRepository,
        Object.assign(
          new Source({ nom: 'Mairie Test', type: SourceTypeEnum.PRIVATE }),
          { siret: '12345678901234' },
        ),
      );

      // Get token from source with token
      const sourceWithToken = await sourceRepository
        .createQueryBuilder('source')
        .addSelect('source.token')
        .where('source.id = :id', { id: source.id })
        .getOne();

      const mockUserInfo: ProConnectUserInfo = {
        sub: 'user-123',
        email: 'agent@mairie.fr',
        given_name: 'Jean',
        usual_name: 'Dupont',
        siret: '12345678901234',
        organizational_unit: 'SDIS 77',
      };

      jest.spyOn(proConnectService, 'handleCallback').mockResolvedValueOnce({
        source: {
          id: source.id,
          nom: source.nom,
          token: sourceWithToken.token,
        },
        userInfo: mockUserInfo,
      });

      const response = await request(app.getHttpServer())
        .get('/proconnect/callback')
        .query({ code: 'auth-code', state: 'test-state' })
        .set('Cookie', [
          'proconnect_state=test-state',
          'proconnect_nonce=test-nonce',
        ])
        .expect(302);

      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin).toBe(MES_SIGNALEMENTS_URL);
      // Controller uses hash routing: /#/proconnect-callback?params
      const hashParams = new URLSearchParams(
        redirectUrl.hash.split('?')[1] || '',
      );
      expect(redirectUrl.hash).toContain('#/proconnect-callback');
      expect(hashParams.get('sourceToken')).toBe(sourceWithToken.token);
      expect(hashParams.get('firstName')).toBe('Jean');
      expect(hashParams.get('lastName')).toBe('Dupont');
      expect(hashParams.get('email')).toBe('agent@mairie.fr');
    });

    it('should redirect to frontend with error on failure', async () => {
      jest
        .spyOn(proConnectService, 'handleCallback')
        .mockRejectedValueOnce(
          new HttpException('Invalid state', HttpStatus.BAD_REQUEST),
        );

      const response = await request(app.getHttpServer())
        .get('/proconnect/callback')
        .query({ code: 'bad-code', state: 'bad-state' })
        .expect(302);

      const redirectUrl = new URL(response.headers.location);
      expect(redirectUrl.origin).toBe(MES_SIGNALEMENTS_URL);
      // Controller uses hash routing: /#/proconnect-callback?error=...
      const hashParams = new URLSearchParams(
        redirectUrl.hash.split('?')[1] || '',
      );
      expect(redirectUrl.hash).toContain('#/proconnect-callback');
      expect(hashParams.get('error')).toBe('Authentication failed');
    });
  });

  describe('GET /proconnect/logout', () => {
    it('should redirect to ProConnect logout URL', async () => {
      const mockLogoutUrl =
        'https://proconnect.example.com/logout?id_token_hint=token123';
      jest
        .spyOn(proConnectService, 'getLogoutUrl')
        .mockResolvedValueOnce(mockLogoutUrl);

      const response = await request(app.getHttpServer())
        .get('/proconnect/logout')
        .query({ idToken: 'token123' })
        .expect(302);

      expect(response.headers.location).toBe(mockLogoutUrl);
    });
  });

  describe('ProConnectService.handleCallback (integration)', () => {
    it('should return existing source when SIRET matches', async () => {
      const source = await createRecording(
        sourceRepository,
        Object.assign(
          new Source({ nom: 'Mairie Existante', type: SourceTypeEnum.PRIVATE }),
          { siret: '99988877766655' },
        ),
      );

      const sourceWithToken = await sourceRepository
        .createQueryBuilder('source')
        .addSelect('source.token')
        .where('source.id = :id', { id: source.id })
        .getOne();

      const mockUserInfo: ProConnectUserInfo = {
        sub: 'user-456',
        email: 'agent@commune.fr',
        given_name: 'Marie',
        usual_name: 'Martin',
        siret: '99988877766655',
        organizational_unit: 'SDIS 77',
      };

      // Mock only the OIDC exchange part, let the source logic run for real
      const mockClient = {
        issuer: { metadata: { issuer: 'https://test-issuer' } },
        callback: jest.fn().mockResolvedValue({ access_token: 'at' }),
        userinfo: jest.fn().mockResolvedValue(mockUserInfo),
      };
      jest
        .spyOn(proConnectService, 'getClient')
        .mockResolvedValue(mockClient as any);
      jest
        .spyOn(inseeService, 'getOrganizationInfo')
        .mockResolvedValue({ nom: 'Mairie Existante', isPublic: true });

      const result = await proConnectService.handleCallback(
        'code',
        'state1',
        'state1',
        'nonce1',
      );

      expect(result.source.id).toBe(source.id);
      expect(result.source.nom).toBe('Mairie Existante');
      expect(result.source.token).toBe(sourceWithToken.token);
      expect(result.userInfo.email).toBe('agent@commune.fr');
    });

    it('should create a new source when no SIRET match', async () => {
      const mockUserInfo: ProConnectUserInfo = {
        sub: 'user-789',
        email: 'new@commune.fr',
        given_name: 'Pierre',
        usual_name: 'Durand',
        siret: '11122233344455',
        organizational_unit: 'SDIS 77',
      };

      const mockClient = {
        issuer: { metadata: { issuer: 'https://test-issuer' } },
        callback: jest.fn().mockResolvedValue({ access_token: 'at' }),
        userinfo: jest.fn().mockResolvedValue(mockUserInfo),
      };
      jest
        .spyOn(proConnectService, 'getClient')
        .mockResolvedValue(mockClient as any);
      jest
        .spyOn(inseeService, 'getOrganizationInfo')
        .mockResolvedValue({ nom: 'Commune Nouvelle', isPublic: true });

      const result = await proConnectService.handleCallback(
        'code',
        'state2',
        'state2',
        'nonce2',
      );

      expect(result.source.id).toBeDefined();
      expect(result.source.nom).toBe('Commune Nouvelle');
      expect(result.source.token).toBeDefined();
      expect(result.userInfo.email).toBe('new@commune.fr');

      // Verify the source was persisted with the SIRET
      const savedSource = await sourceRepository.findOne({
        where: { siret: '11122233344455' },
      });
      expect(savedSource).toBeDefined();
      expect(savedSource.type).toBe(SourceTypeEnum.PRIVATE);
    });

    it('should throw when state does not match', async () => {
      await expect(
        proConnectService.handleCallback('code', 'state-a', 'state-b', 'nonce'),
      ).rejects.toThrow('Invalid state');
    });

    it('should throw when user has no SIRET', async () => {
      const mockUserInfo = {
        sub: 'user-no-siret',
        email: 'nosiret@test.fr',
        given_name: 'No',
        usual_name: 'Siret',
        siret: undefined,
        organizational_unit: 'SDIS 77',
      };

      const mockClient = {
        issuer: { metadata: { issuer: 'https://test-issuer' } },
        callback: jest.fn().mockResolvedValue({ access_token: 'at' }),
        userinfo: jest.fn().mockResolvedValue(mockUserInfo),
      };
      jest
        .spyOn(proConnectService, 'getClient')
        .mockResolvedValue(mockClient as any);

      await expect(
        proConnectService.handleCallback('code', 's', 's', 'n'),
      ).rejects.toThrow('No SIRET found in user info');
    });

    it('should throw when organization is not a public organism', async () => {
      const mockUserInfo: ProConnectUserInfo = {
        sub: 'user-private',
        email: 'private@entreprise.fr',
        given_name: 'Paul',
        usual_name: 'Privé',
        siret: '55566677788899',
        organizational_unit: 'Direction',
      };

      const mockClient = {
        issuer: { metadata: { issuer: 'https://test-issuer' } },
        callback: jest.fn().mockResolvedValue({ access_token: 'at' }),
        userinfo: jest.fn().mockResolvedValue(mockUserInfo),
      };
      jest
        .spyOn(proConnectService, 'getClient')
        .mockResolvedValue(mockClient as any);
      jest
        .spyOn(inseeService, 'getOrganizationInfo')
        .mockResolvedValue({ nom: 'Entreprise Privée SAS', isPublic: false });

      await expect(
        proConnectService.handleCallback('code', 'state', 'state', 'nonce'),
      ).rejects.toThrow(
        'Organization with SIRET 55566677788899 is not a public organism',
      );

      // Verify no source was created
      const source = await sourceRepository.findOne({
        where: { siret: '55566677788899' },
      });
      expect(source).toBeNull();
    });
  });
});
