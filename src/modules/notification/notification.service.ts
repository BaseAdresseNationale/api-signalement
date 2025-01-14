import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SignalementService } from '../signalement/signalement.service';
import { MesAdressesAPIService } from '../mes-adresses-api/mes-adresses-api.service';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly signalementService: SignalementService,
    private readonly mesAdressesAPIService: MesAdressesAPIService,
    private readonly mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  // Cron job that runs every Tuesday at 10:00 AM
  @Cron('0 10 * * 2')
  async weeklyPendingSignalementsReport() {
    this.logger.log('Start task : weeklyPendingSignalementsReport');

    const whiteList = this.configService.get(
      'NOTIFICATIONS_COMMUNE_WHITE_LIST',
    );

    if (!whiteList) {
      this.logger.warn('No white list found');
      return;
    }

    const parsedWhiteList = whiteList.split(',');

    // Get all pending signalement grouped by unique insee code with count

    const pendingSignalementsReport =
      await this.signalementService.getPendingSignalementsReport();

    for (const report of pendingSignalementsReport) {
      const { codeCommune, count } = report;
      if (!parsedWhiteList.includes(codeCommune)) {
        this.logger.warn(
          `Commune ${codeCommune} is not in the white list, skipping`,
        );
        continue;
      }
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
          subject: 'Vous avez des signalements en attente',
          template: 'weekly-report',
          context: {
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
}
