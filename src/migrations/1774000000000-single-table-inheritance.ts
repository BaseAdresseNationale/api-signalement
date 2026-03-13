import { MigrationInterface, QueryRunner } from 'typeorm';

export class SingleTableInheritance1773308681996 implements MigrationInterface {
  name = 'SingleTableInheritance1773308681996';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create enum types
    await queryRunner.query(
      `CREATE TYPE "report_kind_enum" AS ENUM ('alert', 'signalement')`,
    );
    await queryRunner.query(
      `CREATE TYPE "report_type_enum" AS ENUM ('MISSING_ADDRESS', 'LOCATION_TO_UPDATE', 'LOCATION_TO_DELETE', 'LOCATION_TO_CREATE')`,
    );

    // 2. Create the unified reports table
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "report_kind" "report_kind_enum" NOT NULL,
        "code_commune" TEXT NOT NULL,
        "type" "report_type_enum" NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "author" JSONB,
        "point" geometry(Point,4326),
        "source_id" UUID NOT NULL,
        "processed_by" UUID,
        "comment" TEXT,
        "context" JSONB,
        "existing_location" JSONB,
        "changes_requested" JSONB,
        "rejection_reason" TEXT,
        CONSTRAINT "FK_reports_source_id" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_reports_processed_by" FOREIGN KEY ("processed_by") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    // 2. Create spatial index on point
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_point" ON "reports" USING GIST ("point")`,
    );

    // 3. Migrate data from signalements
    await queryRunner.query(`
      INSERT INTO "reports" (
        "id", "created_at", "updated_at", "deleted_at",
        "report_kind", "code_commune", "type", "status",
        "author", "point", "source_id", "processed_by",
        "existing_location", "changes_requested", "rejection_reason"
      )
      SELECT
        "id", "created_at", "updated_at", "deleted_at",
        'signalement'::"report_kind_enum", "code_commune", "type"::text::"report_type_enum", "status"::text,
        "author", "point", "source_id", "processed_by",
        "existing_location", "changes_requested", "rejection_reason"
      FROM "signalements"
    `);

    // 5. Drop old tables
    await queryRunner.query(`DROP TABLE "signalements"`);

    // 6. Drop old enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "signalements_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "signalements_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "signalements_status_enum" AS ENUM ('PENDING', 'IGNORED', 'PROCESSED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "signalements_type_enum" AS ENUM ('LOCATION_TO_UPDATE', 'LOCATION_TO_CREATE', 'LOCATION_TO_DELETE')`,
    );

    // Recreate signalements table
    await queryRunner.query(`
      CREATE TABLE "signalements" (
        "id" UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "code_commune" TEXT NOT NULL,
        "type" "signalements_type_enum" NOT NULL,
        "author" JSONB,
        "existing_location" JSONB,
        "changes_requested" JSONB NOT NULL,
        "status" "signalements_status_enum" NOT NULL,
        "source_id" UUID NOT NULL,
        "processed_by" UUID,
        "point" geometry(Point,4326),
        "rejection_reason" TEXT,
        CONSTRAINT "FK_signalements_source_id" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_signalements_processed_by" FOREIGN KEY ("processed_by") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_signalements_point" ON "signalements" USING GIST ("point")`,
    );

    // Migrate data back to signalements
    await queryRunner.query(`
      INSERT INTO "signalements" (
        "id", "created_at", "updated_at", "deleted_at",
        "code_commune", "type", "status", "author", "point",
        "source_id", "processed_by", "existing_location",
        "changes_requested", "rejection_reason"
      )
      SELECT
        "id", "created_at", "updated_at", "deleted_at",
        "code_commune", "type"::text::"signalements_type_enum", "status"::text::"signalements_status_enum",
        "author", "point", "source_id", "processed_by",
        "existing_location", "changes_requested", "rejection_reason"
      FROM "reports"
      WHERE "report_kind" = 'signalement'
    `);

    // Drop reports table
    await queryRunner.query(`DROP TABLE "reports"`);

    // Drop report enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "report_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_type_enum"`);
  }
}
