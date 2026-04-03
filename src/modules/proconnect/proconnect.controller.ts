import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ProConnectService } from './proconnect.service';

@ApiTags('proconnect')
@Controller('proconnect')
export class ProConnectController {
  constructor(
    private readonly proConnectService: ProConnectService,
    private readonly configService: ConfigService,
  ) {}

  @Get('login')
  @ApiOperation({
    summary: 'Initiate ProConnect login',
    operationId: 'proConnectLogin',
  })
  async login(@Res() res: Response) {
    const { state, nonce } = this.proConnectService.generateAuthParams();

    const authorizationUrl = await this.proConnectService.getAuthorizationUrl(
      state,
      nonce,
    );

    res.redirect(authorizationUrl);
  }

  @Get('callback')
  @ApiOperation({
    summary: 'ProConnect login callback',
    operationId: 'proConnectLoginCallback',
  })
  @ApiQuery({ name: 'code', required: true, type: String })
  @ApiQuery({ name: 'state', required: true, type: String })
  async loginCallback(
    @Res() res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    try {
      const { source, userInfo } = await this.proConnectService.handleCallback(
        code,
        state,
      );

      const params = new URLSearchParams({
        sourceToken: source.token,
        firstName: userInfo.given_name || '',
        lastName: userInfo.usual_name || '',
        email: userInfo.email || '',
      });

      const frontendUrl = this.configService.get<string>(
        'MES_SIGNALEMENTS_URL',
      );

      res.redirect(`${frontendUrl}/#/proconnect-callback?${params.toString()}`);
    } catch (error) {
      console.error('ProConnect login callback error:', error);
      const frontendUrl = this.configService.get<string>(
        'MES_SIGNALEMENTS_URL',
      );
      res.redirect(
        `${frontendUrl}/#/proconnect-callback?error=${encodeURIComponent('Authentication failed')}`,
      );
    }
  }

  @Get('logout')
  @ApiOperation({
    summary: 'Initiate ProConnect logout',
    operationId: 'proConnectLogout',
  })
  @ApiQuery({ name: 'idToken', required: true, type: String })
  async logout(@Res() res: Response, @Query('idToken') idToken: string) {
    const logoutUrl = await this.proConnectService.getLogoutUrl(idToken);

    res.redirect(logoutUrl);
  }
}
