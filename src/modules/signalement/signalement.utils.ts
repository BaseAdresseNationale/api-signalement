import { NumeroChangesRequestedDTO } from './dto/changes-requested.dto';
import { ExistingNumero } from './schemas/existing-location.schema';
import { Signalement } from './signalement.entity';
import { SignalementTypeEnum } from './signalement.types';

export const getSignalementPosition = (signalement: Signalement) => {
  const { changesRequested, existingLocation, type } = signalement;
  let position;
  if (type === SignalementTypeEnum.LOCATION_TO_CREATE) {
    position = (changesRequested as NumeroChangesRequestedDTO)?.positions[0]
      ?.point;
  } else {
    position = (existingLocation as ExistingNumero).position?.point;
  }

  if (position?.coordinates.every((coord) => coord !== null)) {
    return position;
  }
};
