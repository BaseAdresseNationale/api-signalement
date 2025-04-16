import { getCommune } from '../utils/cog.utils';
import { Signalement } from '../modules/signalement/signalement.entity';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { SignalementStatusEnum } from '../modules/signalement/signalement.types';

export class COG2025_1750325214122 implements MigrationInterface {
  name = 'COG2025_1750325214122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let page = 0;
    let total = 0;
    const limit = 100;

    // Get pending signalements
    do {
      page++;
      const [signalements, _total] = await queryRunner.manager.findAndCount(
        Signalement,
        {
          where: {
            status: SignalementStatusEnum.PENDING,
          },
          skip: (page - 1) * limit,
          take: limit,
        },
      );
      total = _total;
      for (const signalement of signalements) {
        const commune = getCommune(signalement.codeCommune);
        if (!commune) {
          console.log(
            `Commune ${signalement.codeCommune} not found for signalement ${signalement.id}, updating to expired`,
          );

          await queryRunner.query(
            `UPDATE "signalements" SET "status" = '${SignalementStatusEnum.EXPIRED}' WHERE id = '${signalement.id}'`,
          );
        }
      }
    } while (page * limit < total);
  }

  public async down(): Promise<void> {}
}
