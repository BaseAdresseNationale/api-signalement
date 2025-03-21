import { Signalement } from '../modules/signalement/signalement.entity';
import { getSignalementPosition } from '../modules/signalement/signalement.utils';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostGisAddSignalementPoint1741898533813
  implements MigrationInterface
{
  name = 'PostGisAddSignalementPoint1741898533813';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "signalements" ADD COLUMN "point" geometry(Point,4326)`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_signalements_point" ON "signalements" USING GIST ("point")`,
    );

    // Get all signalements
    const signalements = await queryRunner.manager.find(Signalement);

    // Update all signalements with their point
    await Promise.all(
      signalements.map((signalement) => {
        const point = getSignalementPosition(signalement);
        if (!point) {
          console.log(
            `Signalement ${signalement.id} has no position, skipping`,
          );
          return Promise.resolve();
        }

        console.log(
          'Updating signalement',
          signalement.id,
          'with point',
          point,
        );

        return queryRunner.query(
          `UPDATE "signalements" SET "point" = ST_SetSRID(ST_MakePoint(${point.coordinates[0]}, ${point.coordinates[1]}), 4326) WHERE id = '${signalement.id}'`,
        );
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "signalements" DROP COLUMN "point"`);

    await queryRunner.query(`DROP INDEX "IDX_signalements_point"`);
  }
}
