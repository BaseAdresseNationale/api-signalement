import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPartenaireId1781234567900 implements MigrationInterface {
  name = 'AddClientPartenaireId1781234567900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN "partenaire_id" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "partenaire_id"`,
    );
  }
}
