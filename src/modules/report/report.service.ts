import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AlertService } from '../alert/alert.service';
import { SignalementService } from '../signalement/signalement.service';
import { ReportStatusEnum } from '../../common/report-status.enum';
import { Alert } from '../alert/alert.entity';
import { Signalement } from '../signalement/signalement.entity';
import { AlertTypeEnum } from '../alert/alert.types';
import { SignalementTypeEnum } from '../signalement/signalement.types';
import { In } from 'typeorm';

export const ReportTypeEnum = { ...AlertTypeEnum, ...SignalementTypeEnum };
export type ReportTypeEnum = AlertTypeEnum | SignalementTypeEnum;

export type ReportItem = (Alert | Signalement) & {
  reportKind: 'alert' | 'signalement';
};

export interface PaginatedReports {
  data: ReportItem[];
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class ReportService {
  constructor(
    @Inject(forwardRef(() => AlertService))
    private alertService: AlertService,
    @Inject(forwardRef(() => SignalementService))
    private signalementService: SignalementService,
  ) {}

  async findMany(
    filters: {
      codeCommune?: string | { _type: string; _value: string[] };
      sourceIds?: string | { _type: string; _value: string[] };
      status?: ReportStatusEnum | { _type: string; _value: ReportStatusEnum[] };
      types?: ReportTypeEnum[];
    },
    pagination: { page: number; limit: number },
  ): Promise<PaginatedReports> {
    const alertTypeValues = Object.values(AlertTypeEnum) as string[];
    const signalementTypeValues = Object.values(
      SignalementTypeEnum,
    ) as string[];

    const requestedTypes = filters.types?.length ? filters.types : undefined;

    const requestedAlertTypes = requestedTypes
      ? requestedTypes.filter((t) => alertTypeValues.includes(t))
      : alertTypeValues;
    const requestedSignalementTypes = requestedTypes
      ? requestedTypes.filter((t) => signalementTypeValues.includes(t))
      : signalementTypeValues;

    const includeAlerts = requestedAlertTypes.length > 0;
    const includeSignalements = requestedSignalementTypes.length > 0;

    const commonFilters: Record<string, any> = {};
    if (filters.codeCommune) {
      commonFilters['codeCommune'] = filters.codeCommune;
    }
    if (filters.sourceIds) {
      commonFilters['source'] = filters.sourceIds;
    }
    if (filters.status) {
      commonFilters['status'] = filters.status;
    }

    const offset = (pagination.page - 1) * pagination.limit;
    // Fetch enough from each source to fill the merged page after sorting
    const fetchLimit = offset + pagination.limit;

    const alertFilters = { ...commonFilters };
    if (requestedTypes && requestedAlertTypes.length < alertTypeValues.length) {
      alertFilters['type'] = In(requestedAlertTypes);
    }

    const signalementFilters = { ...commonFilters };
    if (
      requestedTypes &&
      requestedSignalementTypes.length < signalementTypeValues.length
    ) {
      signalementFilters['type'] = In(requestedSignalementTypes);
    }

    const [alertResult, signalementResult] = await Promise.all([
      includeAlerts
        ? this.alertService.findMany(alertFilters, {
            page: 1,
            limit: fetchLimit,
          })
        : Promise.resolve({ data: [] as Alert[], total: 0, page: 1, limit: 0 }),
      includeSignalements
        ? this.signalementService.findMany(signalementFilters, {
            page: 1,
            limit: fetchLimit,
          })
        : Promise.resolve({
            data: [] as Signalement[],
            total: 0,
            page: 1,
            limit: 0,
          }),
    ]);

    const total = alertResult.total + signalementResult.total;

    // Merge with reportKind discriminant, sort by createdAt DESC, then paginate
    const merged: ReportItem[] = [
      ...alertResult.data.map((a) => ({
        ...a,
        reportKind: 'alert' as const,
      })),
      ...signalementResult.data.map((s) => ({
        ...s,
        reportKind: 'signalement' as const,
      })),
    ];

    merged.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const paginated = merged.slice(offset, offset + pagination.limit);

    return {
      data: paginated,
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }
}
