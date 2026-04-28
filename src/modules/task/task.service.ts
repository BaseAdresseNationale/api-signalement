import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SignalementService } from '../signalement/signalement.service';
import { MesAdressesAPIService } from '../mes-adresses-api/mes-adresses-api.service';
import { DataGouvService } from '../datagouv/datagouv.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { getCommune } from '../../utils/cog.utils';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly signalementService: SignalementService,
    private readonly mesAdressesAPIService: MesAdressesAPIService,
    private readonly dataGouvService: DataGouvService,
    private readonly mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  // Cron job that runs every Tuesday at 10:00 AM
  @Cron('0 10 * * 2')
  async weeklyPendingSignalementsReport() {
    this.logger.log('Start task : weeklyPendingSignalementsReport');

    // Get all pending signalement grouped by unique insee code with count
    const pendingSignalementsReport =
      await this.signalementService.getPendingSignalementsReport();

    for (const report of pendingSignalementsReport) {
      const { codeCommune, count } = report;
      const data = await this.mesAdressesAPIService.searchBaseLocale(
        undefined,
        undefined,
        undefined,
        codeCommune,
        undefined,
        'published',
      );

      if (data.results.length > 1) {
        this.logger.warn(
          `Multiple published BAL for insee code ${codeCommune}`,
        );
        continue;
      } else if (data.results.length === 0) {
        this.logger.warn(`No published BAL for insee code ${codeCommune}`);
        continue;
      }

      const publishedBAL = data.results[0];

      for (const email of publishedBAL.emails) {
        this.logger.log(
          `Sending email to ${email} for BAL ${publishedBAL.id}, commune ${publishedBAL.commune}`,
        );

        await this.mailerService.sendMail({
          to: email,
          subject:
            "Des propositions d'améliorations ont été faites sur votre Base Adresse Locale",
          template: 'weekly-report',
          context: {
            nomCommune: getCommune(codeCommune)?.nom,
            count,
            balUrl: `${this.configService.get(
              'MES_ADRESSES_URL',
            )}/bal/${publishedBAL.id}/signalements`,
          },
        });
      }
    }

    this.logger.log('End task : weeklyPendingSignalementsReport');
  }

  @Cron(CronExpression.EVERY_WEEK)
  async resetCommuneForWebinaire() {
    if (!this.configService.get('RESET_COMMUNE_FOR_WEBINAIRE')) {
      return;
    }

    this.logger.log('Start task : resetCommuneForWebinaire');

    const signalementsToDelete = await this.signalementService.findMany(
      {
        codeCommune: this.configService.get('RESET_COMMUNE_FOR_WEBINAIRE'),
      },
      { page: 1, limit: 1000 },
    );

    for (const signalement of signalementsToDelete.data) {
      await this.signalementService.deleteOne(signalement.id);
    }

    this.logger.log(
      'End task : resetCommuneForWebinaire, deleted ' +
        signalementsToDelete.data.length +
        ' signalements',
    );
  }

  // Cron job that runs every Tuesday at 17:00 PM
  @Cron('0 17 * * 2')
  async weeklyDataGouvCSVExport() {
    const datasetId = this.configService.get('DATAGOUV_DATASET_ID');
    const resourceId = this.configService.get('DATAGOUV_RESOURCE_ID');

    if (!datasetId || !resourceId) {
      this.logger.warn(
        'Skipping weeklyDataGouvCSVExport: DATAGOUV_DATASET_ID or DATAGOUV_RESOURCE_ID not configured',
      );
      return;
    }

    this.logger.log('Start task : weeklyDataGouvCSVExport');

    const countsByCommune =
      await this.signalementService.getSignalementCountsByCommune();

    const header =
      'code_insee,nom_commune,nb_signalements_en_attente,nb_signalements_traites,nb_signalements_ignores,nb_signalements_expires,nb_signalements_total';
    const rows = countsByCommune.map(
      (row) =>
        `${row.codeCommune},${row.nomCommune.includes(',') ? `"${row.nomCommune}"` : row.nomCommune},${row.pending},${row.processed},${row.ignored},${row.expired},${row.total}`,
    );
    const csvContent = [header, ...rows].join('\n');

    await this.dataGouvService.uploadCSVResource(
      datasetId,
      resourceId,
      csvContent,
      'signalements-par-commune.csv',
    );

    this.logger.log('End task : weeklyDataGouvCSVExport');
  }
}
