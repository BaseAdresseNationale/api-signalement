import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SignalementService } from './signalement.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CreateSignalementDTO } from './signalement.dto';
import { Signalement } from './schemas/signalement.schema';

@Controller('signalements')
export class SignalementController {
  constructor(private signalementService: SignalementService) {}

  @Get(':codeCommune')
  @ApiOperation({
    summary: 'Get all signalements for a given codeCommune',
    operationId: 'getSignalementsByCodeCommune',
  })
  @ApiParam({ name: 'codeCommune', required: true, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    type: Array<Signalement>,
  })
  async findOneBaseLocale(@Req() req: Request, @Res() res: Response) {
    const { codeCommune } = req.params;
    const signalements =
      await this.signalementService.getByCodeCommune(codeCommune);

    res.status(HttpStatus.OK).json(signalements);
  }

  // TODO : Implement authentication with client
  @Post('')
  @ApiOperation({
    summary: 'Create a new signalement',
    operationId: 'createBaseLocale',
  })
  @ApiBody({ type: CreateSignalementDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Signalement })
  async createBaseLocale(
    @Req() req: Request,
    @Body() createSignalementDTO: CreateSignalementDTO,
    @Res() res: Response,
  ) {
    const newSignalement =
      await this.signalementService.createOne(createSignalementDTO);

    res.status(HttpStatus.OK).json(newSignalement);
  }
}
