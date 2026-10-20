import { keyBy, groupBy } from 'lodash';
import { FindOperator, Raw } from 'typeorm';
import * as communes from '@etalab/decoupage-administratif/data/communes.json';
import * as departements from '@etalab/decoupage-administratif/data/departements.json';

type CommuneCOG = {
  code: string;
  nom: string;
  typeLiaison: number;
  zone: string;
  arrondissement: string;
  departement: string;
  region: string;
  type: string;
  rangChefLieu: number;
  siren: string;
  codesPostaux: string[];
  population: number;
};

const filteredCommunes: CommuneCOG[] = (communes as Array<any>).filter((c) =>
  ['commune-actuelle', 'arrondissement-municipal'].includes(c.type),
);
const communesIndex: Record<string, CommuneCOG> = keyBy(
  filteredCommunes,
  'code',
);
const departementsIndex = keyBy(departements, 'code');

const communesByDepartementIndex = groupBy(communes, 'departement');

export function getCommunesByDepartement(codeDepartement: string) {
  return communesByDepartementIndex[codeDepartement] || [];
}

export function getCommune(codeCommune: string) {
  return communesIndex[codeCommune];
}

export function getCodesCommunes() {
  return (communes as CommuneCOG[]).map((c) => c.code);
}

export function getDepartement(codeDepartement: string) {
  return departementsIndex[codeDepartement];
}

// Construit le filtre TypeORM sur la colonne `codeCommune` à partir d'une liste
// de codes communes et/ou de codes départements. Un code département match tous
// les codes communes qui commencent par ce code (2 caractères en métropole, 3
// pour les DOM). Retourne `undefined` si aucun critère n'est fourni.
export function buildCodeCommuneFilter(
  codeCommunes: string[],
  codeDepartements: string[],
): FindOperator<string> | undefined {
  const dep2 = codeDepartements.filter((dep) => dep.length === 2);
  const dep3 = codeDepartements.filter((dep) => dep.length === 3);

  if (codeCommunes.length === 0 && dep2.length === 0 && dep3.length === 0) {
    return undefined;
  }

  return Raw(
    (alias) => {
      const conditions: string[] = [];
      if (codeCommunes.length > 0) {
        conditions.push(`${alias} IN (:...codeCommunes)`);
      }
      if (dep2.length > 0) {
        conditions.push(`LEFT(${alias}, 2) IN (:...dep2)`);
      }
      if (dep3.length > 0) {
        conditions.push(`LEFT(${alias}, 3) IN (:...dep3)`);
      }
      return conditions.join(' OR ');
    },
    { codeCommunes, dep2, dep3 },
  );
}
