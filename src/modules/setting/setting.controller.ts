import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../../common/admin.guard';
import { SettingService } from './setting.service';

@ApiTags('settings')
@Controller('settings')
export class SettingController {
  constructor(private settingService: SettingService) {}

  @Get('communes-disabled/:codeCommune')
  @ApiOperation({
    summary: 'Return true if the given codeCommune is disabled',
    operationId: 'isCommuneDisabled',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Boolean,
  })
  async isCommuneDisabled(
    @Req() req: Request,
    @Res() res: Response,
    @Param('codeCommune') codeCommune: string,
  ) {
    const isDisabled = await this.settingService.isCommuneDisabled(codeCommune);

    res.status(HttpStatus.OK).json(isDisabled);
  }

  @Put('communes-disabled/:codeCommune')
  @ApiOperation({
    summary: 'Update the disabled of communes with the given codeCommune',
    operationId: 'updateCommunesDisabled',
  })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async updateCommunesDisabled(
    @Req() req: Request,
    @Res() res: Response,
    @Param('codeCommune') codeCommune: string,
  ) {
    await this.settingService.updateCommunesDisabled(codeCommune);

    res.status(HttpStatus.OK).json({
      message: `Commune ${codeCommune} updated successfully`,
    });
  }
}
