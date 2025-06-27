import {
  Body,
  Controller,
  Delete,
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
import { EnabledListDTO } from './dto/enabled-list.dto';

@ApiTags('settings')
@Controller('settings')
export class SettingController {
  constructor(private settingService: SettingService) {}

  @Get('commune-status/:codeCommune')
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

  @Get('commune-settings/:codeCommune')
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

  @Delete('commune-settings/:codeCommune')
  @ApiOperation({
    summary: 'Delete commune settings for the given codeCommune',
    operationId: 'deleteCommuneSettings',
  })
  @ApiResponse({ status: HttpStatus.OK, type: Boolean })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async deleteCommuneSettings(
    @Req() req: Request,
    @Res() res: Response,
    @Param('codeCommune') codeCommune: string,
  ) {
    await this.settingService.deleteCommuneSettings(codeCommune);

    res.status(HttpStatus.OK).json(true);
  }

  @Post('commune-settings/:codeCommune')
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

  @Get('enabled-list/:listKey/:id')
  @ApiOperation({
    summary:
      'Check if the given id is in the enabled list for the given listKey',
    operationId: 'isInEnabledList',
  })
  @ApiResponse({ status: HttpStatus.OK, type: Boolean })
  async isInEnabledList(
    @Req() req: Request,
    @Res() res: Response,
    @Param('listKey') listKey: EnabledListKeys,
    @Param('id') id: string,
  ) {
    const isInList = await this.settingService.isInEnabledList(listKey, id);

    res.status(HttpStatus.OK).json(isInList);
  }

  @Put('enabled-list/:listKey')
  @ApiOperation({
    summary: 'Update the enabled list for the given listKey',
    operationId: 'updateEnabledList',
  })
  @ApiBody({ type: EnabledListDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Array<string> })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async updateEnabledList(
    @Req() req: Request,
    @Res() res: Response,
    @Param('listKey') listKey: EnabledListKeys,
    @Body() enabledListDTO: EnabledListDTO,
  ) {
    const updatedList = await this.settingService.updateEnabledList(
      listKey,
      enabledListDTO,
    );

    res.status(HttpStatus.OK).json(updatedList);
  }
}
