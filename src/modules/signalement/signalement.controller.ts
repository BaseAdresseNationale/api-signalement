import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SignalementService } from './signalement.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import {
  CreateSignalementDTO,
  UpdateSignalementDTO,
} from './dto/signalement.dto';
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
  async getSignalementsByCodeCommune(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { codeCommune } = req.params;
    const signalements =
      await this.signalementService.getByCodeCommune(codeCommune);

    res.status(HttpStatus.OK).json(signalements);
  }

  // TODO : Implement authentication with client
  @Post('')
  @ApiOperation({
    summary: 'Create a new signalement',
    operationId: 'createSignalement',
  })
  @ApiBody({ type: CreateSignalementDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Signalement })
  async createSignalement(
    @Req() req: Request,
    @Body() createSignalementDTO: CreateSignalementDTO,
    @Res() res: Response,
  ) {
    const newSignalement =
      await this.signalementService.createOne(createSignalementDTO);

    res.status(HttpStatus.OK).json(newSignalement);
  }

  // TODO : Implement authentication with client
  @Put('')
  @ApiOperation({
    summary: 'Update a given signalement',
    operationId: 'updateSignalement',
  })
  @ApiBody({ type: UpdateSignalementDTO, required: true })
  @ApiResponse({ status: HttpStatus.OK, type: Signalement })
  async updateSignalement(
    @Req() req: Request,
    @Body() updateSignalementDTO: UpdateSignalementDTO,
    @Res() res: Response,
  ) {
    const updatedSignalement =
      await this.signalementService.updateOne(updateSignalementDTO);

    res.status(HttpStatus.OK).json(updatedSignalement);
  }
}
