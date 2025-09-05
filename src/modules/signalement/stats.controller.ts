import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { SignalementService } from './signalement.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SignalementStatsDTO } from './dto/stats.dto';

@Controller('stats')
@ApiTags('stats')
export class StatsController {
  constructor(private readonly signalementService: SignalementService) {}

  @Get('')
  @ApiOperation({
    summary: 'Get stats',
    operationId: 'getStats',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SignalementStatsDTO,
  })
  async getStats(@Res() res: Response) {
    const stats = await this.signalementService.getStats();
    res.status(HttpStatus.OK).json(stats);
  }
}
