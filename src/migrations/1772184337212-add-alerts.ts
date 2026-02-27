import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlerts1772184337212 implements MigrationInterface {
  name = 'AddAlerts1772184337212';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create type for status
    await queryRunner.query(
      `CREATE TYPE "alerts_status_enum" AS ENUM ('PENDING', 'IGNORED', 'PROCESSED', 'EXPIRED')`,
    );

    // Create type for type
    await queryRunner.query(
      `CREATE TYPE "alerts_type_enum" AS ENUM ('MISSING_ADDRESS', 'ROAD_PROBLEM', 'OTHER')`,
    );

    // Create table
    await queryRunner.query(
      `CREATE TABLE "alerts" (
        "id" UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "code_commune" text NOT NULL,
        "type" "alerts_type_enum" NOT NULL,
        "point" geometry(Point,4326) NOT NULL,
        "author" jsonb,
        "status" "alerts_status_enum" NOT NULL,
        "source_id" UUID NOT NULL,
        "content" text NOT NULL,
        "processed_by" UUID,
        CONSTRAINT "FK_alerts_source_id" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_alerts_processed_by" FOREIGN KEY (processed_by) REFERENCES clients(id) ON DELETE NO ACTION ON UPDATE NO ACTION
      )`,
    );

    // Create index on point
    await queryRunner.query(
      `CREATE INDEX "IDX_alerts_point" ON "alerts" USING GIST ("point")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "alerts"`);
    await queryRunner.query(`DROP TYPE "alerts_status_enum"`);
    await queryRunner.query(`DROP TYPE "alerts_type_enum"`);
  }
}
