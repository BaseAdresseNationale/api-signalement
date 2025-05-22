import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/admin.guard';
import { SettingService } from './setting.service';
import { CommuneStatusDTO } from './dto/commune-status.dto';
import { CommuneSettingsDTO } from './dto/commune-settings.dto';
import { EnabledListKeys } from './setting.type';

@ApiTags('settings')
@Controller('settings')
export class SettingController {
  constructor(private settingService: SettingService) {}

  @Get('communes-status/:codeCommune')
  @ApiOperation({
    summary: 'Get the submission status of the given commune',
    operationId: 'getCommuneStatus',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: CommuneStatusDTO,
  })
  async getCommuneStatus(
    @Req() req: Request,
    @Res() res: Response,
    @Param('codeCommune') codeCommune: string,
    @Query('sourceId') sourceId: string,
  ) {
    const communeStatus = await this.settingService.getCommuneStatus(
      codeCommune,
      sourceId,
    );

    res.status(HttpStatus.OK).json(communeStatus);
  }

  @Get('communes-settings/:codeCommune')
  @ApiOperation({
    summary: 'Get the communes settings for the given codeCommune',
    operationId: 'getCommuneSettings',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: CommuneSettingsDTO,
  })
  async getCommuneSettings(
    @Req() req: Request,
    @Res() res: Response,
    @Param('codeCommune') codeCommune: string,
  ) {
    const communesSettings =
      await this.settingService.getCommuneSettings(codeCommune);

    res.status(HttpStatus.OK).json(communesSettings);
  }

  @Post('communes-settings/:codeCommune')
  @ApiOperation({
    summary: 'Set the communes settings for the given codeCommune',
    operationId: 'setCommuneSettings',
  })
  @ApiBody({ type: CommuneSettingsDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: CommuneSettingsDTO })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async setCommuneSettings(
    @Req() req: Request,
    @Res() res: Response,
    @Param('codeCommune') codeCommune: string,
    @Body() communeSettings: CommuneSettingsDTO,
  ) {
    const settings = await this.settingService.setCommuneSettings(
      codeCommune,
      communeSettings,
    );

    res.status(HttpStatus.OK).json(settings);
  }

  @Put('enabled-list/:listKey')
  @ApiOperation({
    summary: 'Update the enabled list for the given listKey',
    operationId: 'updateEnabledList',
  })
  @ApiBody({ type: String, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: String })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async updateEnabledList(
    @Req() req: Request,
    @Res() res: Response,
    @Param('listKey') listKey: EnabledListKeys,
    @Body() clientId: string,
  ) {
    const updatedList = await this.settingService.updateEnabledList(
      clientId,
      listKey,
    );

    res.status(HttpStatus.OK).json(updatedList);
  }
}
