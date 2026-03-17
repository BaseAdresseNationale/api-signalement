import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceSiret1710688000000 implements MigrationInterface {
  name = 'AddSourceSiret1710688000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sources" ADD COLUMN "siret" character varying UNIQUE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sources" DROP COLUMN "siret"`);
  }
}
