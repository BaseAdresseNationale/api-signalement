import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectionReason1746196994065 implements MigrationInterface {
  name = 'AddRejectionReason1746196994065';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "signalements" ADD COLUMN "rejection_reason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "signalements" DROP COLUMN "rejection_reason"`,
    );
  }
}
