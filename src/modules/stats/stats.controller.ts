import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { SignalementService } from '../signalement/signalement.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AlertService } from '../alert/alert.service';
import { CombinedStatsDTO } from './stats.dto';

@Controller('stats')
@ApiTags('stats')
export class StatsController {
  constructor(
    private readonly signalementService: SignalementService,
    private readonly alertService: AlertService,
  ) {}

  @Get('')
  @ApiOperation({
    summary: 'Get stats',
    operationId: 'getStats',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: CombinedStatsDTO,
  })
  async getStats(@Res() res: Response) {
    const stats = await Promise.all([
      this.signalementService.getStats(),
      this.alertService.getStats(),
    ]);
    const [signalementStats, alertStats] = stats;
    const combinedStats = {
      signalementStats,
      alertStats,
    };

    res.status(HttpStatus.OK).json(combinedStats);
  }
}
