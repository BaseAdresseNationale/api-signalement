import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeExistingLocationNullable1753954345161
  implements MigrationInterface
{
  name = 'MakeExistingLocationNullable1753954345161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make existing location nullable
    await queryRunner.query(
      `ALTER TABLE "signalements" ALTER COLUMN "existing_location" DROP NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "signalements" ALTER COLUMN "existing_location" SET NOT NULL`,
    );
  }
}
