import { EnabledListKeys } from '../modules/setting/setting.type';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSettings1747315664342 implements MigrationInterface {
  name = 'AddSettings1747315664342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "settings" (
        "id" UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "name" text NOT NULL UNIQUE,
        "content" jsonb NOT NULL
      )`,
    );

    await queryRunner.query(
      `INSERT INTO "settings" (name, content) VALUES ('${EnabledListKeys.API_DEPOT_CLIENTS_ENABLED}', '[]')`,
    );
    await queryRunner.query(
      `INSERT INTO "settings" (name, content) VALUES ('${EnabledListKeys.SOURCES_MOISSONNEUR_ENABLED}', '[]')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "settings"`);
  }
}
