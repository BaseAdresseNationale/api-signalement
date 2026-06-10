import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceDefaultAuthor1781234567890 implements MigrationInterface {
  name = 'AddSourceDefaultAuthor1781234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sources" ADD COLUMN "defaultAuthor" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sources" DROP COLUMN "defaultAuthor"`,
    );
  }
}
