import { SignalementStatusEnum } from '../modules/signalement/signalement.types';
import { Signalement } from '../modules/signalement/signalement.entity';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { NumeroChangesRequestedDTO } from '../modules/signalement/dto/changes-requested.dto';

export class FixNumeroStringInChangesRequested1753283848477
  implements MigrationInterface
{
  name = 'FixNumeroStringInChangesRequested1753283848477';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get all signalements
    const signalements = await queryRunner.manager.find(Signalement, {
      where: {
        status: SignalementStatusEnum.PENDING,
      },
    });

    // Update all signalements with their point
    await Promise.all(
      signalements
        .filter(
          ({ changesRequested }) =>
            (changesRequested as NumeroChangesRequestedDTO).numero &&
            typeof (changesRequested as NumeroChangesRequestedDTO).numero ===
              'string',
        )
        .map(({ id, changesRequested }: { id: string; changesRequested }) => {
          const { numero } = changesRequested as NumeroChangesRequestedDTO;

          console.log(
            `Signalement ${id} has a string numero, converting to number : ${numero}`,
          );

          return queryRunner.query(
            `UPDATE "signalements" SET "changes_requested" = jsonb_set("changes_requested", '{numero}', $1) WHERE id = $2`,
            [parseInt(numero as unknown as string, 10), id],
          );
        }),
    );
  }

  public async down(): Promise<void> {}
}
