import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlertContext1773456000000 implements MigrationInterface {
  name = 'AddAlertContext1773456000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN "context" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "context"`);
  }
}
