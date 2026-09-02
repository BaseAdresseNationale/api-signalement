import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Client } from '../modules/client/client.entity';
import { ReportService } from '../modules/report/report.service';
import { BalAdminService } from '../modules/bal-admin/bal-admin.service';

// Scope les tokens partenaire à leur périmètre géographique : si le client
// authentifié porte un `partenaireId`, il ne peut consulter/traiter que les
// signalements dont la commune fait partie du périmètre BAL-admin du partenaire.
@Injectable()
export class PartenairePerimeterGuard implements CanActivate {
  private readonly logger = new Logger(PartenairePerimeterGuard.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly balAdminService: BalAdminService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request & { registeredClient?: Client } =
      context.getArgByIndex(0);

    const partenaireId = req.registeredClient?.partenaireId;
    // Pas de périmètre défini : accès inchangé.
    if (!partenaireId) {
      return true;
    }

    const reportId = req.params.idSignalement ?? req.params.idAlert;
    const codeCommune = await this.reportService.findCodeCommune(reportId);
    if (!codeCommune) {
      throw new ForbiddenException('Report not found');
    }

    let communes: string[];
    try {
      communes = await this.balAdminService.getPartenaireCommunes(partenaireId);
    } catch (error) {
      // Fail closed : en cas d'erreur BAL-admin on refuse l'accès.
      this.logger.error(
        `Impossible de récupérer le périmètre du partenaire ${partenaireId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new ForbiddenException('Unable to verify perimeter');
    }

    if (!communes.includes(codeCommune)) {
      throw new ForbiddenException(
        'This report is outside your partner geographic perimeter',
      );
    }

    return true;
  }
}
