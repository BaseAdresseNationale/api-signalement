import { MigrationInterface, QueryRunner } from 'typeorm';

export class SingleTableInheritance1774000000000 implements MigrationInterface {
  name = 'SingleTableInheritance1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the unified reports table
    await queryRunner.query(`
      CREATE TABLE "reports" (
        "id" UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "report_kind" VARCHAR NOT NULL,
        "code_commune" TEXT NOT NULL,
        "type" TEXT NOT NULL,
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
        'signalement', "code_commune", "type"::text, "status"::text,
        "author", "point", "source_id", "processed_by",
        "existing_location", "changes_requested", "rejection_reason"
      FROM "signalements"
    `);

    // 4. Migrate data from alerts
    await queryRunner.query(`
      INSERT INTO "reports" (
        "id", "created_at", "updated_at", "deleted_at",
        "report_kind", "code_commune", "type", "status",
        "author", "point", "source_id", "processed_by",
        "comment", "context"
      )
      SELECT
        "id", "created_at", "updated_at", "deleted_at",
        'alert', "code_commune", "type"::text, "status"::text,
        "author", "point", "source_id", "processed_by",
        "comment", "context"
      FROM "alerts"
    `);

    // 5. Drop old tables
    await queryRunner.query(`DROP TABLE "signalements"`);
    await queryRunner.query(`DROP TABLE "alerts"`);

    // 6. Drop old enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "alerts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "alerts_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "signalements_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "signalements_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate enum types
    await queryRunner.query(
      `CREATE TYPE "alerts_status_enum" AS ENUM ('PENDING', 'IGNORED', 'PROCESSED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "alerts_type_enum" AS ENUM ('MISSING_ADDRESS')`,
    );
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

    // Recreate alerts table
    await queryRunner.query(`
      CREATE TABLE "alerts" (
        "id" UUID NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "code_commune" TEXT NOT NULL,
        "type" "alerts_type_enum" NOT NULL,
        "point" geometry(Point,4326) NOT NULL,
        "author" JSONB,
        "status" "alerts_status_enum" NOT NULL,
        "source_id" UUID NOT NULL,
        "comment" TEXT NOT NULL,
        "processed_by" UUID,
        "context" JSONB,
        CONSTRAINT "FK_alerts_source_id" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_alerts_processed_by" FOREIGN KEY ("processed_by") REFERENCES "clients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_alerts_point" ON "alerts" USING GIST ("point")`,
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
        "code_commune", "type"::"signalements_type_enum", "status"::"signalements_status_enum",
        "author", "point", "source_id", "processed_by",
        "existing_location", "changes_requested", "rejection_reason"
      FROM "reports"
      WHERE "report_kind" = 'signalement'
    `);

    // Migrate data back to alerts
    await queryRunner.query(`
      INSERT INTO "alerts" (
        "id", "created_at", "updated_at", "deleted_at",
        "code_commune", "type", "status", "author", "point",
        "source_id", "comment", "processed_by", "context"
      )
      SELECT
        "id", "created_at", "updated_at", "deleted_at",
        "code_commune", "type"::"alerts_type_enum", "status"::"alerts_status_enum",
        "author", "point", "source_id", "comment", "processed_by", "context"
      FROM "reports"
      WHERE "report_kind" = 'alert'
    `);

    // Drop reports table
    await queryRunner.query(`DROP TABLE "reports"`);
  }
}
