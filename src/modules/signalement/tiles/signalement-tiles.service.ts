import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SignalementService } from '../signalement.service';
import { Signalement } from '../signalement.entity';
import { BaseReportTilesService } from '../../../common/base-report-tiles.service';
import { ReportStatusEnum } from '../../../common/report-status.enum';

@Injectable()
export class SignalementTilesService extends BaseReportTilesService<Signalement> {
  constructor(
    @Inject(forwardRef(() => SignalementService))
    private signalementService: SignalementService,
  ) {
    super();
  }

  protected findManyWhereInBBox(
    bbox: number[],
    filters: { status?: ReportStatusEnum },
  ): Promise<Signalement[]> {
    return this.signalementService.findManyWhereInBBox(bbox, filters);
  }
}
