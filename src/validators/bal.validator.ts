import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { getLabel, readValue } from '@ban-team/validateur-bal';

async function validateurBAL(value, label) {
  const { errors } = await readValue(label, value);

  return {
    errors: errors.map((error) => getLabel(`${label}.${error}`)),
  };
}

@ValidatorConstraint({ name: 'validatorBal', async: true })
export class ValidatorBal implements ValidatorConstraintInterface {
  private lastErrorCache = {};

  private addError(property: string, errors: string[]) {
    if (!this.lastErrorCache[property]) {
      this.lastErrorCache[property] = [];
    }
    this.lastErrorCache[property].push(...errors);
  }

  async validateField(value: any, label: any, property: string) {
    const { errors } = await validateurBAL(value, label);
    this.addError(property, errors);

    return errors.length === 0;
  }

  async validate(value: any, args: ValidationArguments) {
    if (value === undefined || value === null) {
      return true;
    }
    try {
      const property = args.property;
      const BALfield = args.constraints[0];
      this.lastErrorCache[property] = [];

      if (['numero', 'suffixe', 'position', 'voie_nom'].includes(BALfield)) {
        return await this.validateField(value.toString(), BALfield, property);
      } else if (BALfield === 'cad_parcelles') {
        return await this.validateField(value.join('|'), BALfield, property);
      }
    } catch {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const { value, property } = args;

    console.log('args', args);

    if (this.lastErrorCache[property].length > 0) {
      return this.lastErrorCache[property]
        .map((error) => `${property}:${error}`)
        .join(', ');
    }
    return 'Erreur de validation pour le champ ' + property + ': ' + value;
  }
}
