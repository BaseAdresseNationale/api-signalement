import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPublicationInfo1781234567910
  implements MigrationInterface
{
  name = 'AddClientPublicationInfo1781234567910';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "clients_publication_type_enum" AS ENUM ('api_depot', 'moissonneur')`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN "publication_type" "clients_publication_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" ADD COLUMN "publication_id" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "publication_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clients" DROP COLUMN "publication_type"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "clients_publication_type_enum"`,
    );
  }
}
