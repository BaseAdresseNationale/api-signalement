import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Issuer, Client, generators } from 'openid-client';
import { SourceService } from '../source/source.service';
import { SourceTypeEnum } from '../source/source.types';
import { InseeService } from './insee.service';
import { createHmac } from 'crypto';

export interface ProConnectUserInfo {
  sub: string;
  email: string;
  given_name: string;
  usual_name: string;
  siret: string;
  organizational_unit: string;
}

export interface OrganizationInfo {
  nom: string;
  isPublic: boolean;
}

@Injectable()
export class ProConnectService {
  private readonly logger = new Logger(ProConnectService.name);
  private client: Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly sourceService: SourceService,
    private readonly inseeService: InseeService,
  ) {}

  async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    const discoveryUrl =
      this.configService.get<string>('PROCONNECT_ENDPOINT') +
      '/api/v2/.well-known/openid-configuration';
    const clientId = this.configService.get<string>('PROCONNECT_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'PROCONNECT_CLIENT_SECRET',
    );

    const issuer = await Issuer.discover(discoveryUrl);

    this.client = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [
        this.configService.get<string>('API_SIGNALEMENT_URL') +
          '/proconnect/callback',
      ],
      post_logout_redirect_uris: [
        this.configService.get<string>('MES_SIGNALEMENTS_URL'),
      ],
      response_types: ['code'],
      id_token_signed_response_alg: 'RS256',
      userinfo_signed_response_alg: 'RS256',
    });

    return this.client;
  }

  private get signingSecret(): string {
    return this.configService.get<string>('PROCONNECT_CLIENT_SECRET');
  }

  private signState(stateValue: string, nonce: string): string {
    const payload = JSON.stringify({ s: stateValue, n: nonce });
    const sig = createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex');
    return Buffer.from(
      JSON.stringify({ s: stateValue, n: nonce, sig }),
    ).toString('base64url');
  }

  private verifyAndDecodeState(state: string): {
    stateValue: string;
    nonce: string;
  } {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      const { s, n, sig } = decoded;
      const payload = JSON.stringify({ s, n });
      const expectedSig = createHmac('sha256', this.signingSecret)
        .update(payload)
        .digest('hex');

      if (sig !== expectedSig) {
        throw new Error('Invalid signature');
      }

      return { stateValue: s, nonce: n };
    } catch {
      throw new HttpException('Invalid state', HttpStatus.BAD_REQUEST);
    }
  }

  generateAuthParams(): { state: string; nonce: string } {
    const nonce = generators.nonce();
    const stateValue = generators.state();
    const state = this.signState(stateValue, nonce);
    return { state, nonce };
  }

  async getAuthorizationUrl(state: string, nonce: string): Promise<string> {
    const client = await this.getClient();

    return client.authorizationUrl({
      scope: 'openid given_name usual_name email siret',
      state,
      nonce,
      acr_values: 'eidas1',
    });
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{
    source: { id: string; nom: string; token: string };
    userInfo: ProConnectUserInfo;
  }> {
    const { nonce } = this.verifyAndDecodeState(state);

    const client = await this.getClient();
    const redirectUri =
      this.configService.get<string>('API_SIGNALEMENT_URL') +
      '/proconnect/callback';

    const tokenSet = await client.callback(
      redirectUri,
      { code, state, iss: client.issuer.metadata.issuer },
      {
        state,
        nonce,
      },
    );

    const userInfo = await client.userinfo<ProConnectUserInfo>(tokenSet);

    if (!userInfo.siret) {
      throw new HttpException(
        'Aucun SIRET trouvé dans les informations utilisateur',
        HttpStatus.BAD_REQUEST,
      );
    }

    const organizationInfo = await this.inseeService.getOrganizationInfo(
      userInfo.siret,
    );

    if (!organizationInfo) {
      throw new HttpException(
        `Aucune organisation trouvée pour le SIRET ${userInfo.siret}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!organizationInfo.isPublic) {
      throw new HttpException(
        {
          error: 'ORGANIZATION_NOT_PUBLIC',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (organizationInfo.isCommune) {
      throw new HttpException(
        {
          error: `COMMUNE_NOT_ALLOWED`,
          errorLink: `${this.configService.get<string>('MES_ADRESSES_URL')}/new?commune=${organizationInfo.codeCommune}`,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    let source = await this.sourceService.findOneBySiret(userInfo.siret);

    if (!source) {
      this.logger.log(`Creating new source for SIRET ${userInfo.siret}`);
      source = await this.sourceService.createOne({
        nom: organizationInfo.nom,
        type: SourceTypeEnum.PRIVATE,
        siret: userInfo.siret,
      });
    }

    // Retrieve the source with the token (not selected by default)
    const sourceWithToken = await this.sourceService.findOneWithToken(
      source.id,
    );

    return {
      source: {
        id: sourceWithToken.id,
        nom: sourceWithToken.nom,
        token: sourceWithToken.token,
      },
      userInfo,
    };
  }

  async getLogoutUrl(idTokenHint: string): Promise<string> {
    const client = await this.getClient();
    const postLogoutRedirectUri = this.configService.get<string>(
      'MES_SIGNALEMENTS_URL',
    );

    return client.endSessionUrl({
      id_token_hint: idTokenHint,
      state: generators.state(),
      post_logout_redirect_uri: postLogoutRedirectUri,
    });
  }
}
