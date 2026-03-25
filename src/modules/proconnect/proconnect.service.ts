import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Issuer, Client, generators } from 'openid-client';
import { SourceService } from '../source/source.service';
import { SourceTypeEnum } from '../source/source.types';

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
        this.configService.get<string>('MES_SIGNALEMENTS_URL') +
          '/?proconnect-logout=success',
      ],
      response_types: ['code'],
      id_token_signed_response_alg: 'RS256',
      userinfo_signed_response_alg: 'RS256',
    });

    return this.client;
  }

  generateAuthParams(): { state: string; nonce: string } {
    return {
      state: generators.state(),
      nonce: generators.nonce(),
    };
  }

  async getOrganizationInfo(siret: string): Promise<OrganizationInfo | null> {
    const apiUrl = this.configService.get<string>('INSEE_API_URL');
    const apiKey = this.configService.get<string>('INSEE_API_KEY_INTEGRATION');

    if (!apiKey || !apiUrl) {
      return null;
    }

    try {
      const response = await fetch(`${apiUrl}/siret/${siret}`, {
        headers: {
          'X-INSEE-Api-Key-Integration': apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const etablissement = data.etablissement;
      const uniteLegale = etablissement?.uniteLegale;

      let nom: string | null = null;

      if (uniteLegale?.denominationUniteLegale) {
        nom = uniteLegale.denominationUniteLegale;
      } else if (uniteLegale?.nomUniteLegale) {
        nom =
          `${uniteLegale.prenomUsuelUniteLegale || ''} ${uniteLegale.nomUniteLegale}`.trim();
      }

      if (!nom) {
        return null;
      }

      const categorieJuridique =
        uniteLegale?.categorieJuridiqueUniteLegale || '';
      const isPublic = categorieJuridique.startsWith('7');

      return { nom, isPublic };
    } catch (error) {
      this.logger.error(
        `Error fetching organization info for SIRET ${siret}: ${error.message}`,
      );
      return null;
    }
  }

  async getAuthorizationUrl(state: string, nonce: string): Promise<string> {
    const client = await this.getClient();

    return client.authorizationUrl({
      scope: 'openid given_name usual_name email  siret',
      state,
      nonce,
      acr_values: 'eidas1',
    });
  }

  async handleCallback(
    code: string,
    state: string,
    storedState: string,
    storedNonce: string,
  ): Promise<{
    source: { id: string; nom: string; token: string };
    userInfo: ProConnectUserInfo;
  }> {
    if (state !== storedState) {
      throw new HttpException('Invalid state', HttpStatus.BAD_REQUEST);
    }

    const client = await this.getClient();
    const redirectUri =
      this.configService.get<string>('API_SIGNALEMENT_URL') +
      '/proconnect/callback';

    const tokenSet = await client.callback(
      redirectUri,
      { code, state, iss: client.issuer.metadata.issuer },
      {
        state: storedState,
        nonce: storedNonce,
      },
    );

    const userInfo = await client.userinfo<ProConnectUserInfo>(tokenSet);

    if (!userInfo.siret) {
      throw new HttpException(
        'No SIRET found in user info',
        HttpStatus.BAD_REQUEST,
      );
    }

    const organizationInfo = await this.getOrganizationInfo(userInfo.siret);

    if (!organizationInfo) {
      throw new HttpException(
        `No organization found for SIRET ${userInfo.siret}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!organizationInfo.isPublic) {
      throw new HttpException(
        `Organization with SIRET ${userInfo.siret} is not a public organism`,
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
    const postLogoutRedirectUri =
      this.configService.get<string>('MES_SIGNALEMENTS_URL') +
      '/?proconnect-logout=success';

    return client.endSessionUrl({
      id_token_hint: idTokenHint,
      state: generators.state(),
      post_logout_redirect_uri: postLogoutRedirectUri,
    });
  }
}
