import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AlertService } from '../alert.service';
import { Alert } from '../alert.entity';
import { BaseReportTilesService } from '../../../common/base-report-tiles.service';
import { ReportStatusEnum } from '../../../common/report-status.enum';

@Injectable()
export class AlertTilesService extends BaseReportTilesService<Alert> {
  constructor(
    @Inject(forwardRef(() => AlertService))
    private alertService: AlertService,
  ) {
    super();
  }

  protected findManyWhereInBBox(
    bbox: number[],
    filters: { status?: ReportStatusEnum },
  ): Promise<Alert[]> {
    return this.alertService.findManyWhereInBBox(bbox, filters);
  }
}
