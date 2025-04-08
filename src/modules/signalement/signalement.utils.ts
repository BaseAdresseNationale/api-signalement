import { NumeroChangesRequestedDTO } from './dto/changes-requested.dto';
import {
  ExistingLocationTypeEnum,
  ExistingNumero,
  ExistingVoie,
} from './schemas/existing-location.schema';
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

  if (
    position &&
    position.coordinates.length === 2 &&
    position.coordinates.every((coord) => coord !== null)
  ) {
    return position;
  }
};

const formatAdresseLabel = (
  numero: number,
  nomVoie: string,
  suffixe?: string,
) => {
  const suffixeLabel = suffixe ? ` ${suffixe}` : '';

  return `${numero}${suffixeLabel} ${nomVoie}`;
};

export const getSignalementLocationTypeLabel = (
  signalement: Signalement,
): string => {
  const { existingLocation, type } = signalement;

  if (type === SignalementTypeEnum.LOCATION_TO_CREATE) {
    return `l'adresse`;
  }

  switch (existingLocation.type) {
    case ExistingLocationTypeEnum.NUMERO:
      return `l'adresse`;
    case ExistingLocationTypeEnum.VOIE:
      return `la voie`;
    case ExistingLocationTypeEnum.TOPONYME:
      return `le lieu-dit`;
    default:
      return '';
  }
};

export const getSignalementLocationLabel = (
  signalement: Signalement,
): string => {
  const { changesRequested, existingLocation, type } = signalement;

  if (type === SignalementTypeEnum.LOCATION_TO_CREATE) {
    const changesRequestedNumero =
      changesRequested as NumeroChangesRequestedDTO;
    return `${formatAdresseLabel(changesRequestedNumero.numero, changesRequestedNumero.nomVoie, changesRequestedNumero.suffixe)}`;
  }

  if (existingLocation.type === ExistingLocationTypeEnum.NUMERO) {
    const existingLocationNumero = existingLocation as ExistingNumero;
    return `${formatAdresseLabel(
      existingLocationNumero.numero,
      existingLocationNumero.toponyme.nom,
      existingLocationNumero.suffixe,
    )}`;
  } else {
    const existingLocationToponyme = existingLocation as ExistingVoie;
    return `${existingLocationToponyme.nom}`;
  }
};
