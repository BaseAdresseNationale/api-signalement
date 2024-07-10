import { Controller, Get, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SignalementService } from './signalement.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SignalementStatsDTO } from './dto/stats.dto';
import { AdminGuard } from '../../common/admin.guard';

@Controller('stats')
@ApiTags('stats')
export class StatsController {
  constructor(private signalementService: SignalementService) {}

  @Get('')
  @ApiOperation({
    summary: 'Get stats',
    operationId: 'getStats',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: SignalementStatsDTO,
  })
  @ApiBearerAuth('admin-token')
  @UseGuards(AdminGuard)
  async getStats(@Res() res: Response) {
    const stats = await this.signalementService.getStats();
    res.status(HttpStatus.OK).json(stats);
  }
}
