import { connect, disconnect, model } from 'mongoose';
import * as signalementsPifometre from '../data/signalements-pifometre.json';
import {
  Signalement,
  SignalementSchema,
} from '../src/modules/signalement/schemas/signalement.schema';
import {
  ExistingLocationTypeEnum,
  ExistingNumero,
  ExistingVoie,
} from '../src/modules/signalement/schemas/existing-location.schema';
import { ChangesRequested } from '../src/modules/signalement/schemas/changes-requested.schema';
import { SignalementTypeEnum } from '../src/modules/signalement/signalement.types';
import * as dotenv from 'dotenv';

dotenv.config();

const pifometreSourceId = '664f3a9059acd3ae493d9f59';

const getNumeroAndSuffixe = (numero: string) => {
  const re = new RegExp(/(\d+)([a-zA-Z]*)/);
  const match = re.exec(numero);
  return {
    numero: parseInt(match[1]),
    suffixe: match[2]?.toLowerCase(),
  };
};

const SignalementModel = model<Signalement>('signalements', SignalementSchema);

async function run() {
  await connect(process.env.MONGODB_URL);

  const signalements = signalementsPifometre.features
    .map(({ properties }) => ({
      codeCommune: properties.code_insee,
      numero: properties.numero,
      nomVoie: properties.nom_voie,
      date: properties.date_remontee,
      source: properties.source,
      comment: properties.commentaire,
    }))
    .filter(({ source }) => source === 'BAN');

  for await (const signalementData of signalements) {
    const signalement = new Signalement();
    signalement.codeCommune = signalementData.codeCommune;
    signalement.type = SignalementTypeEnum.OTHER;

    const existingNumero = new ExistingNumero();

    const { numero, suffixe } = getNumeroAndSuffixe(signalementData.numero);
    existingNumero.numero = numero;
    if (suffixe) {
      existingNumero.suffixe = suffixe;
    }
    existingNumero.type = ExistingLocationTypeEnum.NUMERO;
    const existingVoie = new ExistingVoie();
    existingVoie.nom = signalementData.nomVoie;
    existingVoie.type = ExistingLocationTypeEnum.VOIE;
    existingNumero.toponyme = existingVoie;
    signalement.existingLocation = existingNumero;

    const changesRequested = new ChangesRequested();
    changesRequested.comment = signalementData.comment;
    signalement.changesRequested = changesRequested;

    await SignalementModel.create({
      source: pifometreSourceId,
      ...signalement,
    });
  }

  await disconnect();
  process.exit(1);
}

run().catch((err) => console.log(err));
